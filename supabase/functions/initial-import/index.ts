import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Server configuration error");
    }

    const { userId, folderId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get first day of current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFrom = firstDayOfMonth.toISOString();

    console.log(`Starting initial import for user ${userId} from ${dateFrom}`);

    // List files from the current month
    const listResponse = await fetch(`${SUPABASE_URL}/functions/v1/list-drive-files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ 
        userId, 
        folderId,
        dateFrom,
      }),
    });

    if (!listResponse.ok) {
      const error = await listResponse.json();
      throw new Error(error.error || "Failed to list files");
    }

    const { files } = await listResponse.json();
    console.log(`Found ${files.length} files from current month`);

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No files to import",
          imported: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already imported files
    const { data: importedFiles } = await supabase
      .from("imported_files")
      .select("drive_file_id")
      .eq("user_id", userId);

    const importedIds = new Set((importedFiles || []).map(f => f.drive_file_id));
    const filesToImport = files.filter((f: { id: string }) => !importedIds.has(f.id));

    console.log(`${filesToImport.length} new files to import`);

    // Create pending records for all files
    for (const file of filesToImport) {
      await supabase
        .from("imported_files")
        .upsert({
          user_id: userId,
          drive_file_id: file.id,
          file_name: file.name,
          status: "pending",
        }, { onConflict: "user_id,drive_file_id" });
    }

    // Process files in background (limit to 5 at a time to avoid rate limits)
    const results: { fileId: string; fileName: string; success: boolean; error?: string }[] = [];
    const batchSize = 3;

    for (let i = 0; i < filesToImport.length; i += batchSize) {
      const batch = filesToImport.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file: { id: string; name: string }) => {
        try {
          const importResponse = await fetch(`${SUPABASE_URL}/functions/v1/import-and-analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ 
              userId, 
              fileId: file.id,
              fileName: file.name,
            }),
          });

          const result = await importResponse.json();
          
          if (!importResponse.ok) {
            return { fileId: file.id, fileName: file.name, success: false, error: result.error };
          }
          
          return { fileId: file.id, fileName: file.name, success: true };
        } catch (error) {
          console.error(`Error importing ${file.name}:`, error);
          return { 
            fileId: file.id, 
            fileName: file.name, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < filesToImport.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update drive_last_sync
    await supabase
      .from("profiles")
      .update({ drive_last_sync: new Date().toISOString() })
      .eq("user_id", userId);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`Initial import complete: ${successCount} success, ${errorCount} errors`);

    // Create notification about import
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: "Importação inicial concluída",
        message: `${successCount} calls importadas e analisadas.${errorCount > 0 ? ` ${errorCount} falharam.` : ""}`,
        type: errorCount > 0 ? "warning" : "success",
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: successCount,
        errors: errorCount,
        total: filesToImport.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in initial-import:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
