import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

// Declare EdgeRuntime type for Deno/Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= LOGGER HELPER =============
class Logger {
  // deno-lint-ignore no-explicit-any
  private supabase: any;
  private service: string;
  private userId: string | null;
  private startTime: number;

  // deno-lint-ignore no-explicit-any
  constructor(service: string, supabase: any, userId: string | null = null) {
    this.service = service;
    this.userId = userId;
    this.startTime = Date.now();
    this.supabase = supabase;
  }

  private async log(
    level: 'debug' | 'info' | 'warning' | 'error' | 'critical',
    operation: string,
    metadata: Record<string, unknown> = {},
    errorMessage: string | null = null
  ) {
    const duration = Date.now() - this.startTime;

    console.log(`[${level.toUpperCase()}] ${this.service}:${operation}`, JSON.stringify(metadata));

    try {
      await this.supabase.rpc('log_event', {
        p_level: level,
        p_service: this.service,
        p_user_id: this.userId,
        p_operation: operation,
        p_duration_ms: duration,
        p_metadata: metadata,
        p_error_message: errorMessage
      });
    } catch (err) {
      console.error('Failed to write log to database:', err);
    }
  }

  info(operation: string, metadata: Record<string, unknown> = {}) {
    return this.log('info', operation, metadata);
  }

  warning(operation: string, metadata: Record<string, unknown> = {}, errorMessage: string | null = null) {
    return this.log('warning', operation, metadata, errorMessage);
  }

  error(operation: string, error: Error | string, metadata: Record<string, unknown> = {}) {
    const errorMessage = error instanceof Error ? error.message : error;
    return this.log('error', operation, metadata, errorMessage);
  }
}

interface PendingFile {
  id: string;
  drive_file_id: string;
  file_name: string;
}

// Safe JSON parser
async function safeReadJson(response: Response): Promise<{ data: unknown; error: string | null }> {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return { data: null, error: "Empty response from function" };
    }
    try {
      const data = JSON.parse(text);
      return { data, error: null };
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return { data: null, error: `JSON parse error: ${parseError}` };
    }
  } catch (readError) {
    return { data: null, error: `Failed to read response: ${readError}` };
  }
}

// Process a single file with timeout and retry
const ANALYSIS_TIMEOUT_MS = 90000; // 90 seconds

async function processFile(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  fileId: string,
  fileName: string,
  maxRetries = 2
): Promise<{ success: boolean; error?: string }> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxRetries}] Processing: ${fileName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/import-and-analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            "x-processor-call": "true", // Identifies coordinated call to bypass processing check
          },
          body: JSON.stringify({ userId, fileId, fileName }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const { data: result, error: parseError } = await safeReadJson(response);
        const resultObj = result as { error?: string; alreadyImported?: boolean } | null;

        // Rate limit handling
        if (response.status === 429 || resultObj?.error?.toLowerCase().includes("rate limit")) {
          const waitTime = Math.min(15000 * Math.pow(2, attempt - 1), 60000);
          console.log(`Rate limit hit, waiting ${waitTime/1000}s...`);
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }

        // Empty response - retry
        if (parseError === "Empty response from function") {
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }

        if (parseError || !response.ok) {
          return { success: false, error: parseError || resultObj?.error || `HTTP ${response.status}` };
        }

        return { success: true };

      } catch (fetchErr) {
        clearTimeout(timeoutId);
        
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          console.log(`Timeout for: ${fileName}`);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          return { success: false, error: "Timeout" };
        }
        throw fetchErr;
      }

    } catch (err) {
      console.error(`Exception on attempt ${attempt}:`, err);
      if (attempt === maxRetries) {
        return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

// Reset stale files before processing
async function resetStaleFiles(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string
): Promise<number> {
  // Reset files stuck in 'processing' for more than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
  
  const { data: staleFiles, error } = await supabase
    .from("imported_files")
    .update({ 
      status: "pending", 
      started_processing_at: null,
      error_message: null 
    })
    .eq("user_id", userId)
    .eq("status", "processing")
    .lt("started_processing_at", fiveMinutesAgo)
    .select("id");

  if (error) {
    console.error("Error resetting stale files:", error);
    return 0;
  }

  return staleFiles?.length || 0;
}

// Main processing function for a single user
async function processUserFilesBackground(
  supabaseUrl: string,
  serviceRoleKey: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  userName: string,
  sessionId: string,
  maxFiles: number,
  fileDelayMs: number
): Promise<void> {
  const logger = new Logger('process-user-files', supabase, userId);
  
  try {
    console.log(`[${userName}] Starting individual processing session: ${sessionId}`);
    await logger.info('session_started', { sessionId, userName, maxFiles });

    // 1. Reset any stale files first
    const resetCount = await resetStaleFiles(supabase, userId);
    if (resetCount > 0) {
      console.log(`[${userName}] Reset ${resetCount} stale files`);
    }

    // 2. Get pending files using atomic lock function (FOR UPDATE SKIP LOCKED)
    const { data: pendingFiles, error: fetchError } = await supabase
      .rpc('claim_pending_files', {
        p_user_id: userId,
        p_max_files: maxFiles
      });

    if (fetchError) {
      throw new Error(`Failed to claim pending files: ${fetchError.message}`);
    }

    const files = pendingFiles as PendingFile[] | null;
    
    if (!files || files.length === 0) {
      console.log(`[${userName}] No pending files to process`);
      
      // Mark session as completed
      await supabase
        .from("user_import_sessions")
        .upsert({
          user_id: userId,
          session_id: sessionId,
          status: "completed",
          total_files: 0,
          processed_files: 0,
          success_count: 0,
          error_count: 0,
          completed_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      
      return;
    }

    console.log(`[${userName}] Claimed ${files.length} files with atomic lock`);

    // 3. Update session with total
    await supabase
      .from("user_import_sessions")
      .upsert({
        user_id: userId,
        session_id: sessionId,
        status: "running",
        total_files: files.length,
        processed_files: 0,
        success_count: 0,
        error_count: 0,
        started_at: new Date().toISOString(),
        current_file_name: null,
      }, { onConflict: "user_id" });

    let successCount = 0;
    let errorCount = 0;

    // 4. Process each file sequentially (already locked atomically)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check if session was cancelled
      const { data: session } = await supabase
        .from("user_import_sessions")
        .select("status")
        .eq("user_id", userId)
        .single();

      if (session?.status === "cancelled") {
        console.log(`[${userName}] Session cancelled by user`);
        break;
      }

      // Lock already done in claim_pending_files() - no need to lock here again

      // Update session progress
      const { error: progressError } = await supabase
        .from("user_import_sessions")
        .update({
          current_file_name: file.file_name,
          processed_files: i,
          success_count: successCount,
          error_count: errorCount,
        })
        .eq("user_id", userId);

      if (progressError) {
        console.error(`Failed to update session progress:`, progressError);
        // Continue processing - progress tracking failure shouldn't block imports
      }

      // Process the file
      const result = await processFile(
        supabaseUrl,
        serviceRoleKey,
        userId,
        file.drive_file_id,
        file.file_name
      );

      if (result.success) {
        successCount++;
        console.log(`[${userName}] ✓ ${file.file_name}`);
      } else {
        errorCount++;
        console.log(`[${userName}] ✗ ${file.file_name}: ${result.error}`);

        // Increment retry count
        const { error: retryError } = await supabase.rpc('increment_file_retry', {
          p_file_id: file.id
        });
        if (retryError) {
          console.error(`Failed to increment retry count for file ${file.id}:`, retryError);
        }

        // Mark file as error instead of leaving in processing
        const { error: updateError } = await supabase
          .from("imported_files")
          .update({
            status: "error",
            error_message: result.error || "Falha no processamento",
            started_processing_at: null
          })
          .eq("id", file.id);

        if (updateError) {
          console.error(`Failed to mark file ${file.id} as error:`, updateError);
        }
      }

      // Delay between files - minimum 2 seconds to prevent race conditions
      if (i < files.length - 1) {
        const effectiveDelay = Math.max(fileDelayMs, 2000);
        await new Promise(r => setTimeout(r, effectiveDelay));
      }
    }

    // 5. Cleanup: Reset any files still stuck in 'processing' to 'pending'
    const { data: stuckFiles, error: stuckError } = await supabase
      .from("imported_files")
      .update({
        status: "pending",
        started_processing_at: null,
        error_message: "Reset após sessão"
      })
      .eq("user_id", userId)
      .eq("status", "processing")
      .select("id");

    if (stuckError) {
      console.error(`Failed to reset stuck files:`, stuckError);
      // Continue - cleanup failure shouldn't block session completion
    } else if (stuckFiles && stuckFiles.length > 0) {
      console.log(`[${userName}] Reset ${stuckFiles.length} stuck files after session`);
    }

    // 6. Mark session as completed
    const { error: sessionCompleteError } = await supabase
      .from("user_import_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        processed_files: files.length,
        success_count: successCount,
        error_count: errorCount,
        current_file_name: null,
      })
      .eq("user_id", userId);

    if (sessionCompleteError) {
      console.error(`CRITICAL: Failed to mark session as completed:`, sessionCompleteError);
      // This is critical - if this fails, user won't be able to start new sessions
      throw new Error(`Failed to complete session: ${sessionCompleteError.message}`);
    }

    console.log(`[${userName}] Completed: ${successCount} success, ${errorCount} errors`);
    
    // Log session completion
    await logger.info('session_completed', { 
      sessionId, 
      successCount, 
      errorCount, 
      totalFiles: files.length 
    });

  } catch (error) {
    console.error(`[${userName}] Error in processing:`, error);
    
    // Log session error
    await logger.error('session_failed', error as Error, { sessionId });
    
    // Cleanup stuck files on error too
    await supabase
      .from("imported_files")
      .update({ 
        status: "pending", 
        started_processing_at: null,
        error_message: "Reset após erro de sessão" 
      })
      .eq("user_id", userId)
      .eq("status", "processing");

    // Mark session as error
    await supabase
      .from("user_import_sessions")
      .update({
        status: "error",
        completed_at: new Date().toISOString(),
        current_file_name: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("user_id", userId);
  }
}

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
    const body = await req.json();
    const userId = body.userId;
    const maxFiles = body.maxFiles || 50;
    const fileDelayMs = body.fileDelayMs || 3000;
    const resetErrors = body.resetErrors !== false;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, google_connected")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // deno-lint-ignore no-explicit-any
    const profileData = profile as any;
    if (!profileData.google_connected) {
      return new Response(
        JSON.stringify({ error: "Google not connected for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = profileData.full_name;

    // Check if user already has an active session
    const { data: existingSession } = await supabase
      .from("user_import_sessions")
      .select("status, started_at")
      .eq("user_id", userId)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const sessionData = existingSession as any;
    if (sessionData?.status === "running") {
      const startedAt = new Date(sessionData.started_at);
      const minutesRunning = Math.floor((Date.now() - startedAt.getTime()) / 60000);
      
      // If running for more than 10 minutes, consider it stale and allow restart
      if (minutesRunning < 10) {
        return new Response(
          JSON.stringify({ 
            error: `Processamento já em andamento há ${minutesRunning} minutos`,
            alreadyRunning: true,
            sessionId: sessionData.status
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Reset error files if requested
    if (resetErrors) {
      const { data: resetFiles } = await supabase
        .from("imported_files")
        .update({ status: "pending", error_message: null })
        .eq("user_id", userId)
        .eq("status", "error")
        .not("error_message", "ilike", "%chat%")
        .not("error_message", "ilike", "%vazio%")
        .select("id");

      // deno-lint-ignore no-explicit-any
      if (resetFiles && (resetFiles as any[]).length > 0) {
        // deno-lint-ignore no-explicit-any
        console.log(`Reset ${(resetFiles as any[]).length} error files to pending for ${userName}`);
      }
    }

    // Count pending files
    const { count: pendingCount } = await supabase
      .from("imported_files")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");

    const totalPending = pendingCount || 0;
    const sessionId = crypto.randomUUID();

    if (totalPending === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Nenhum arquivo pendente para processar",
          sessionId,
          pendingFiles: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${userName}] Starting processing of ${totalPending} files, session: ${sessionId}`);

    // Create initial session record
    await supabase
      .from("user_import_sessions")
      .upsert({
        user_id: userId,
        session_id: sessionId,
        status: "running",
        total_files: totalPending,
        processed_files: 0,
        success_count: 0,
        error_count: 0,
        started_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    // FIRE-AND-FORGET: Start background processing
    EdgeRuntime.waitUntil(
      processUserFilesBackground(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        supabase,
        userId,
        userName,
        sessionId,
        maxFiles,
        fileDelayMs
      )
    );

    // Return immediate response
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Iniciando processamento de ${totalPending} arquivos`,
        sessionId,
        pendingFiles: totalPending
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in process-user-files:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
