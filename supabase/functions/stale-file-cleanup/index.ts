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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    console.log("Running stale file cleanup...");
    
    const results = {
      staleFilesReset: 0,
      orphanedSessionsFixed: 0,
      staleSessionsReset: 0,
    };

    // 1. Reset files stuck in 'processing' for more than 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 180000).toISOString();
    
    const { data: staleFiles, error: staleFilesError } = await supabase
      .from("imported_files")
      .update({ 
        status: "pending", 
        started_processing_at: null,
        error_message: null 
      })
      .eq("status", "processing")
      .lt("started_processing_at", threeMinutesAgo)
      .select("id, file_name, user_id");

    if (staleFilesError) {
      console.error("Error resetting stale files:", staleFilesError);
    } else {
      results.staleFilesReset = staleFiles?.length || 0;
      if (results.staleFilesReset > 0) {
        console.log(`Reset ${results.staleFilesReset} stale files:`, 
          staleFiles?.map(f => f.file_name).join(", "));
      }
    }

    // 2. Also reset files stuck in 'processing' without started_processing_at (legacy)
    const { data: legacyStaleFiles, error: legacyError } = await supabase
      .from("imported_files")
      .update({ 
        status: "pending", 
        error_message: null 
      })
      .eq("status", "processing")
      .is("started_processing_at", null)
      .select("id");

    if (!legacyError && legacyStaleFiles) {
      results.staleFilesReset += legacyStaleFiles.length;
      if (legacyStaleFiles.length > 0) {
        console.log(`Reset ${legacyStaleFiles.length} legacy stale files (no timestamp)`);
      }
    }

    // 3. Mark orphaned import_progress sessions as 'error' (running for > 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 900000).toISOString();
    
    const { data: orphanedSessions, error: orphanedError } = await supabase
      .from("import_progress")
      .update({ 
        status: "error", 
        completed_at: new Date().toISOString(),
        current_file_name: "Timeout - sessão expirada"
      })
      .eq("status", "running")
      .lt("started_at", fifteenMinutesAgo)
      .select("id, session_id");

    if (orphanedError) {
      console.error("Error fixing orphaned sessions:", orphanedError);
    } else {
      results.orphanedSessionsFixed = orphanedSessions?.length || 0;
      if (results.orphanedSessionsFixed > 0) {
        console.log(`Fixed ${results.orphanedSessionsFixed} orphaned import_progress sessions`);
      }
    }

    // 4. Mark orphaned user_import_sessions as 'error' (running for > 15 minutes)
    const { data: staleUserSessions, error: staleUserError } = await supabase
      .from("user_import_sessions")
      .update({ 
        status: "error", 
        completed_at: new Date().toISOString(),
        current_file_name: "Timeout - sessão expirada"
      })
      .eq("status", "running")
      .lt("started_at", fifteenMinutesAgo)
      .select("id, user_id");

    if (staleUserError) {
      console.error("Error fixing stale user sessions:", staleUserError);
    } else {
      results.staleSessionsReset = staleUserSessions?.length || 0;
      if (results.staleSessionsReset > 0) {
        console.log(`Fixed ${results.staleSessionsReset} stale user_import_sessions`);
      }
    }

    // 5. Auto-retry: Reset retryable errors (max 5 attempts)
    const retryablePatterns = [
      '%Empty response%',
      '%Timeout%',
      '%AbortError%',
      '%No chunks analyzed%',
      '%timeout%',
      '%TIMEOUT%',
      '%Fetch timeout%'
    ];

    let autoRetried = 0;

    for (const pattern of retryablePatterns) {
      const { data: retryFiles, error: retryError } = await supabase
        .from("imported_files")
        .update({
          status: "pending",
          error_message: null,
          started_processing_at: null
        })
        .eq("status", "error")
        .like("error_message", pattern)
        .lt("retry_count", 5)
        .select("id");

      if (retryError) {
        console.error(`Error retrying pattern ${pattern}:`, retryError);
      } else if (retryFiles?.length) {
        autoRetried += retryFiles.length;
        console.log(`Auto-retried ${retryFiles.length} files matching pattern: ${pattern}`);
      }
    }

    console.log("Cleanup completed:", { ...results, autoRetried });

    return new Response(
      JSON.stringify({
        success: true,
        results: { ...results, autoRetried },
        message: `Cleanup: ${results.staleFilesReset} arquivos resetados, ${results.orphanedSessionsFixed + results.staleSessionsReset} sessões corrigidas, ${autoRetried} arquivos para auto-retry`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in stale-file-cleanup:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
