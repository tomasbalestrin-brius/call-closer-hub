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

    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user profile with sync settings
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("drive_folder_id, drive_last_sync, drive_name_patterns, google_connected")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.google_connected) {
      return new Response(
        JSON.stringify({ error: "Google Drive not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use last sync time or 7 days ago as fallback
    const lastSync = profile.drive_last_sync 
      ? new Date(profile.drive_last_sync).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`Syncing files for user ${userId} since ${lastSync}`);

    // List new files since last sync
    const listResponse = await fetch(`${SUPABASE_URL}/functions/v1/list-drive-files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ 
        userId, 
        folderId: profile.drive_folder_id,
        dateFrom: lastSync,
      }),
    });

    if (!listResponse.ok) {
      const error = await listResponse.json();
      throw new Error(error.error || "Failed to list files");
    }

    const { files } = await listResponse.json();
    console.log(`Found ${files.length} files since last sync`);

    if (files.length === 0) {
      // Update sync time even if no new files
      await supabase
        .from("profiles")
        .update({ drive_last_sync: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No new files",
          synced: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already imported files
    const fileIds = files.map((f: { id: string }) => f.id);
    const { data: importedFiles } = await supabase
      .from("imported_files")
      .select("drive_file_id")
      .eq("user_id", userId)
      .in("drive_file_id", fileIds);

    const importedIds = new Set((importedFiles || []).map(f => f.drive_file_id));
    const newFiles = files.filter((f: { id: string }) => !importedIds.has(f.id));

    console.log(`${newFiles.length} new files to import`);

    // Filter by name patterns if configured
    let filesToImport = newFiles;
    const patterns = profile.drive_name_patterns as string[] | null;
    
    if (patterns && patterns.length > 0) {
      filesToImport = newFiles.filter((file: { name: string }) => {
        return patterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, ".*"), "i");
          return regex.test(file.name);
        });
      });
      console.log(`After pattern filter: ${filesToImport.length} files`);
    }

    // Process new files
    const results: { fileId: string; fileName: string; success: boolean; error?: string }[] = [];
    
    for (const file of filesToImport) {
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
          results.push({ fileId: file.id, fileName: file.name, success: false, error: result.error });
        } else {
          results.push({ fileId: file.id, fileName: file.name, success: true });
        }

        // Small delay between imports
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error importing ${file.name}:`, error);
        results.push({ 
          fileId: file.id, 
          fileName: file.name, 
          success: false, 
          error: error instanceof Error ? error.message : "Unknown error" 
        });
      }
    }

    // Update last sync time
    await supabase
      .from("profiles")
      .update({ drive_last_sync: new Date().toISOString() })
      .eq("user_id", userId);

    const successCount = results.filter(r => r.success).length;

    // Create notification if new files were synced
    if (successCount > 0) {
      await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          title: "Novas calls sincronizadas",
          message: `${successCount} novas calls foram importadas e analisadas automaticamente.`,
          type: "info",
        });
    }

    console.log(`Sync complete: ${successCount} imported`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: successCount,
        total: filesToImport.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in sync-drive-files:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
