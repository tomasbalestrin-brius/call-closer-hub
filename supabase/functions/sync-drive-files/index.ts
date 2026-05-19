import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Safe JSON parser that handles empty/truncated responses
async function safeReadJson(response: Response): Promise<{ data: unknown; error: string | null }> {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error("Empty response received");
      return { data: null, error: "Empty response from function" };
    }
    try {
      const data = JSON.parse(text);
      return { data, error: null };
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Raw text (first 500 chars):", text.substring(0, 500));
      return { data: { __raw: text }, error: `JSON parse error: ${parseError}` };
    }
  } catch (readError) {
    console.error("Failed to read response:", readError);
    return { data: null, error: `Failed to read response: ${readError}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error("Server configuration error");
    }

    const { userId } = await req.json();

    if (!userId || typeof userId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return new Response(
        JSON.stringify({ error: "Valid userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization: allow service role (internal cron/orchestrator) OR
    // an authenticated user that matches userId OR an admin.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const callerId = claimsData.claims.sub as string;
      if (callerId !== userId) {
        const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: roleRow } = await svc.from("user_roles")
          .select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
        if (!roleRow) {
          return new Response(JSON.stringify({ error: "Forbidden" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
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

    // Data mínima fixa: apenas arquivos de fevereiro de 2026 em diante
    const MIN_IMPORT_DATE = '2026-02-01T00:00:00.000Z';

    // Use last sync time or 7 days ago as fallback
    const lastSync = profile.drive_last_sync 
      ? new Date(profile.drive_last_sync).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Garantir que não puxe arquivos anteriores a janeiro de 2026
    const effectiveDate = lastSync < MIN_IMPORT_DATE ? MIN_IMPORT_DATE : lastSync;

    console.log(`Syncing files for user ${userId} since ${effectiveDate} (MIN: ${MIN_IMPORT_DATE})`);

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
        dateFrom: effectiveDate, // Usar data efetiva (respeitando MIN_IMPORT_DATE)
      }),
    });

    const { data: listResult, error: listError } = await safeReadJson(listResponse);

    if (listError || !listResponse.ok) {
      const errorMsg = listError || (listResult as { error?: string })?.error || "Failed to list files";
      throw new Error(errorMsg);
    }

    interface DriveFile {
      id: string;
      name: string;
    }

    // Padrões de título que devem ser EXCLUÍDOS (não são calls válidas)
    const EXCLUDED_TITLE_PATTERNS = [
      /anotações do gemini/i,
      /transcrição do chat/i,
    ];

    function shouldExcludeFile(fileName: string): boolean {
      return EXCLUDED_TITLE_PATTERNS.some(pattern => pattern.test(fileName));
    }
    
    const files = ((listResult as { files?: DriveFile[] })?.files || []) as DriveFile[];
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

    // Get already imported files - ONLY consider "completed" as truly imported
    const fileIds = files.map((f) => f.id);
    const { data: importedFiles } = await supabase
      .from("imported_files")
      .select("drive_file_id, status")
      .eq("user_id", userId)
      .in("drive_file_id", fileIds);

    // Only skip files that were successfully completed
    const completedIds = new Set(
      (importedFiles || [])
        .filter(f => f.status === 'completed')
        .map(f => f.drive_file_id)
    );
    
    const newFiles = files.filter((f) => !completedIds.has(f.id));

    console.log(`${newFiles.length} files to process (excluding ${completedIds.size} completed)`);

    // Filter out excluded title patterns (not valid calls)
    let filesToImport: DriveFile[] = newFiles.filter((f) => !shouldExcludeFile(f.name));
    const excludedCount = newFiles.length - filesToImport.length;
    if (excludedCount > 0) {
      console.log(`Excluded ${excludedCount} files with invalid title patterns (Anotações do Gemini, Transcrição do chat)`);
    }

    // Filter by name patterns if configured
    const patterns = profile.drive_name_patterns as string[] | null;
    
    if (patterns && patterns.length > 0) {
      filesToImport = filesToImport.filter((file) => {
        return patterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, ".*"), "i");
          return regex.test(file.name);
        });
      });
      console.log(`After pattern filter: ${filesToImport.length} files`);
    }

    if (filesToImport.length === 0) {
      await supabase
        .from("profiles")
        .update({ drive_last_sync: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No new files to import",
          synced: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process new files SEQUENTIALLY with robust error handling
    const results: { fileId: string; fileName: string; success: boolean; error?: string }[] = [];
    const maxFilesPerExecution = 20; // Increased for faster processing
    const filesToProcess = filesToImport.slice(0, maxFilesPerExecution);
    
    console.log(`Processing ${filesToProcess.length} files out of ${filesToImport.length} total`);
    
    for (const file of filesToProcess) {
      try {
        console.log(`Importing file: ${file.name} (${file.id})`);
        
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

        const { data: result, error: parseError } = await safeReadJson(importResponse);
        
        if (parseError) {
          console.error(`Failed to parse response for ${file.name}:`, parseError);
          results.push({ fileId: file.id, fileName: file.name, success: false, error: parseError });
        } else if (!importResponse.ok) {
          const errorMsg = (result as { error?: string })?.error || "Unknown error";
          console.error(`Import failed for ${file.name}:`, errorMsg);
          results.push({ fileId: file.id, fileName: file.name, success: false, error: errorMsg });
        } else {
          console.log(`Successfully imported: ${file.name}`);
          results.push({ fileId: file.id, fileName: file.name, success: true });
        }

        // Reduced delay between imports for faster processing
        await new Promise(resolve => setTimeout(resolve, 200));
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
    const remainingCount = filesToImport.length - filesToProcess.length;

    // Create notification if new files were synced
    if (successCount > 0) {
      await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          title: "Novas calls sincronizadas",
          message: `${successCount} novas calls foram importadas e analisadas automaticamente.${remainingCount > 0 ? ` ${remainingCount} aguardando.` : ""}`,
          type: "info",
        });
    }

    console.log(`Sync complete: ${successCount} imported, ${remainingCount} remaining`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: successCount,
        remaining: remainingCount,
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
