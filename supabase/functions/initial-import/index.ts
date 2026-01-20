import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
}

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

async function refreshTokenIfNeeded(
  supabaseUrl: string,
  serviceRoleKey: string,
  profile: { user_id: string; google_access_token: string; google_refresh_token: string; google_token_expires_at: string }
): Promise<string> {
  const expiresAt = new Date(profile.google_token_expires_at);
  const now = new Date();
  
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log("Token expired or expiring soon, refreshing...");
    
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: profile.google_refresh_token,
        grant_type: "refresh_token",
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token refresh failed:", error);
      throw new Error("Failed to refresh Google token");
    }
    
    const tokens = await tokenResponse.json();
    const newExpiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await supabase
      .from("profiles")
      .update({
        google_access_token: tokens.access_token,
        google_token_expires_at: newExpiresAt,
      } as Record<string, unknown>)
      .eq("user_id", profile.user_id);
    
    console.log("Token refreshed successfully");
    return tokens.access_token;
  }
  
  return profile.google_access_token;
}

async function listFilesFromDrive(
  accessToken: string,
  folderId: string | null,
  dateFrom: string
): Promise<DriveFile[]> {
  const targetFolderId = folderId || "root";
  
  // Build query - get documents from current month
  let query = `'${targetFolderId}' in parents and trashed = false`;
  query += ` and createdTime >= '${dateFrom}'`;
  query += ` and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'text/plain' or mimeType = 'application/pdf')`;

  console.log("Fetching files with query:", query);

  const filesResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc&pageSize=100`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!filesResponse.ok) {
    const error = await filesResponse.text();
    console.error("Failed to list files:", error);
    throw new Error("Failed to list Google Drive files");
  }

  const filesData = await filesResponse.json();
  return filesData.files || [];
}

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

    console.log(`Starting initial import for user ${userId}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user profile with Google tokens
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, google_access_token, google_refresh_token, google_token_expires_at, drive_folder_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.google_access_token) {
      console.error("Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "Google Drive not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      profile as { user_id: string; google_access_token: string; google_refresh_token: string; google_token_expires_at: string }
    );

    // Fixed minimum import date: January 2026
    const MIN_IMPORT_DATE = '2026-01-01T00:00:00.000Z';
    const dateFrom = MIN_IMPORT_DATE;

    console.log(`Fetching files from ${dateFrom} (fixed minimum date)`);

    // Use provided folderId or profile's folderId
    const targetFolderId = folderId || profile.drive_folder_id || null;
    
    // List files directly from Google Drive
    const files = await listFilesFromDrive(accessToken, targetFolderId, dateFrom);
    
    console.log(`Found ${files.length} files from current month`);

    if (files.length === 0) {
      // Update last sync even if no files
      await supabase
        .from("profiles")
        .update({ drive_last_sync: new Date().toISOString() })
        .eq("user_id", userId);

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

    // Get already imported files - ONLY consider "completed" as truly imported
    // Files with pending/processing/error status should be eligible for retry
    const { data: importedFiles } = await supabase
      .from("imported_files")
      .select("drive_file_id, status")
      .eq("user_id", userId);

    // Only skip files that were successfully completed
    const completedIds = new Set(
      (importedFiles || [])
        .filter(f => f.status === 'completed')
        .map(f => f.drive_file_id)
    );
    
    const filesToImport = files.filter((f: DriveFile) => !completedIds.has(f.id));

    console.log(`${filesToImport.length} files to import (excluding ${completedIds.size} completed)`);

    if (filesToImport.length === 0) {
      await supabase
        .from("profiles")
        .update({ drive_last_sync: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No new files to import",
          imported: 0,
          total: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update pending records for all files
    for (const file of filesToImport) {
      await supabase
        .from("imported_files")
        .upsert({
          user_id: userId,
          drive_file_id: file.id,
          file_name: file.name,
          status: "pending",
          imported_at: new Date().toISOString(),
        }, { onConflict: "user_id,drive_file_id" });
    }

    // Process files SEQUENTIALLY (batchSize = 1) to avoid timeout/connection issues
    const results: { fileId: string; fileName: string; success: boolean; error?: string }[] = [];
    const maxFilesPerExecution = 5; // Limit files per execution to prevent timeout
    const filesToProcess = filesToImport.slice(0, maxFilesPerExecution);

    for (const file of filesToProcess) {
      try {
        console.log(`Processing file: ${file.name} (${file.id})`);
        
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
          continue;
        }
        
        if (!importResponse.ok) {
          const errorMsg = (result as { error?: string })?.error || "Unknown error";
          console.error(`Failed to import ${file.name}:`, errorMsg);
          results.push({ fileId: file.id, fileName: file.name, success: false, error: errorMsg });
        } else {
          console.log(`Successfully imported: ${file.name}`);
          results.push({ fileId: file.id, fileName: file.name, success: true });
        }
        
        // Small delay between files to prevent overwhelming
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

    // Update drive_last_sync
    await supabase
      .from("profiles")
      .update({ drive_last_sync: new Date().toISOString() })
      .eq("user_id", userId);

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const remainingCount = filesToImport.length - filesToProcess.length;

    console.log(`Initial import complete: ${successCount} success, ${errorCount} errors, ${remainingCount} remaining`);

    // Create notification about import
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: "Importação inicial concluída",
        message: `${successCount} calls importadas e analisadas.${errorCount > 0 ? ` ${errorCount} falharam.` : ""}${remainingCount > 0 ? ` ${remainingCount} aguardando.` : ""}`,
        type: errorCount > 0 ? "warning" : "success",
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: successCount,
        errors: errorCount,
        remaining: remainingCount,
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
