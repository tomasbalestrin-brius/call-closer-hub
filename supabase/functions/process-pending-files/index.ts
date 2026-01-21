import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Type definitions
interface PendingFile {
  id: string;
  drive_file_id: string;
  file_name: string;
}

interface User {
  user_id: string;
  full_name: string;
  google_connected: boolean;
  google_access_token: string | null;
}

interface UserResult {
  userId: string;
  userName: string;
  pendingBefore: number;
  processed: number;
  success: number;
  errors: number;
  details: Array<{ fileName: string; success: boolean; error?: string }>;
}

interface ProgressTracker {
  processed: number;
  success: number;
  errors: number;
}

// Safe JSON parser that handles empty/truncated responses
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
      console.error("JSON parse error:", parseError, "Raw text:", text.substring(0, 200));
      return { data: null, error: `JSON parse error: ${parseError}` };
    }
  } catch (readError) {
    return { data: null, error: `Failed to read response: ${readError}` };
  }
}

// Process a single file with retry logic and timeout safety
const ANALYSIS_TIMEOUT_MS = 90000; // 90 seconds max per file

async function processWithRetry(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  fileId: string,
  fileName: string,
  maxRetries = 3
): Promise<{ success: boolean; result?: unknown; error?: string; alreadyImported?: boolean }> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for file: ${fileName}`);
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/import-and-analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            userId,
            fileId,
            fileName,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const { data: result, error: parseError } = await safeReadJson(response);

        // Check for rate limit errors
        const resultObj = result as { error?: string; alreadyImported?: boolean } | null;
        const isRateLimit = 
          response.status === 429 || 
          parseError?.includes("Rate limit") ||
          resultObj?.error?.includes("Rate limit") ||
          resultObj?.error?.includes("rate limit");

        if (isRateLimit) {
          // Exponential backoff: 15s, 30s, 60s
          const waitTime = Math.min(15000 * Math.pow(2, attempt - 1), 60000); 
          console.log(`Rate limit hit on attempt ${attempt}. Waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Check for empty response (might be timeout)
        if (parseError === "Empty response from function") {
          const waitTime = attempt * 10000; // 10s, 20s, 30s
          console.log(`Empty response on attempt ${attempt}. Waiting ${waitTime/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // If we got an error that's not rate limit, return it
        if (parseError || !response.ok) {
          return { 
            success: false, 
            error: parseError || resultObj?.error || `HTTP ${response.status}` 
          };
        }

        // Check if already imported
        if (resultObj?.alreadyImported) {
          return { success: true, alreadyImported: true, result };
        }

        // Success!
        return { success: true, result };

      } catch (fetchErr) {
        clearTimeout(timeoutId);
        
        // Check if it was a timeout/abort
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          console.log(`Timeout (${ANALYSIS_TIMEOUT_MS/1000}s) on attempt ${attempt} for: ${fileName}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
          return { success: false, error: `Timeout após ${ANALYSIS_TIMEOUT_MS/1000}s` };
        }
        throw fetchErr;
      }

    } catch (err) {
      console.error(`Exception on attempt ${attempt}:`, err);
      
      if (attempt === maxRetries) {
        return { 
          success: false, 
          error: err instanceof Error ? err.message : "Unknown error" 
        };
      }
      
      // Wait before retrying on exception
      const waitTime = attempt * 5000;
      console.log(`Exception on attempt ${attempt}. Waiting ${waitTime/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  return { success: false, error: "Max retries exceeded" };
}

// Process all files for a single user (runs sequentially within user)
async function processUserFiles(
  supabaseUrl: string,
  serviceRoleKey: string,
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any>,
  user: User,
  maxFilesPerUser: number,
  sessionId: string,
  progressTracker: ProgressTracker,
  fileDelayMs: number
): Promise<UserResult | null> {
  // Get pending files for this user
  const { data: pendingFiles, error: pendingError } = await supabase
    .from("imported_files")
    .select("id, drive_file_id, file_name")
    .eq("user_id", user.user_id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(maxFilesPerUser);

  if (pendingError) {
    console.error(`Error fetching pending files for ${user.full_name}:`, pendingError);
    return {
      userId: user.user_id,
      userName: user.full_name,
      pendingBefore: 0,
      processed: 0,
      success: 0,
      errors: 1,
      details: [{ fileName: "N/A", success: false, error: pendingError.message }],
    };
  }

  const files = pendingFiles as PendingFile[] | null;

  if (!files || files.length === 0) {
    console.log(`No pending files for ${user.full_name}`);
    return null;
  }

  console.log(`[${user.full_name}] Processing ${files.length} files`);

  const userResult: UserResult = {
    userId: user.user_id,
    userName: user.full_name,
    pendingBefore: files.length,
    processed: 0,
    success: 0,
    errors: 0,
    details: [],
  };

  for (const file of files) {
    console.log(`[${user.full_name}] Processing: ${file.file_name}`);

    // Increment global counter atomically (JS single-threaded, so this is safe)
    progressTracker.processed++;

    // Update progress
    await supabase
      .from("import_progress")
      .update({
        processed_files: progressTracker.processed,
        success_count: progressTracker.success,
        error_count: progressTracker.errors,
        current_file_name: file.file_name,
        current_closer_name: user.full_name,
      })
      .eq("session_id", sessionId);

    // Process with retry logic
    const processResult = await processWithRetry(
      supabaseUrl,
      serviceRoleKey,
      user.user_id,
      file.drive_file_id,
      file.file_name
    );

    userResult.processed++;

    if (processResult.success) {
      if (processResult.alreadyImported) {
        console.log(`[${user.full_name}] Already imported: ${file.file_name}`);
      } else {
        console.log(`[${user.full_name}] Success: ${file.file_name}`);
      }
      userResult.success++;
      progressTracker.success++;
      userResult.details.push({ fileName: file.file_name, success: true });
    } else {
      console.error(`[${user.full_name}] Error: ${file.file_name}:`, processResult.error);
      userResult.errors++;
      progressTracker.errors++;
      userResult.details.push({
        fileName: file.file_name,
        success: false,
        error: processResult.error?.substring(0, 200),
      });
    }

    // Update progress after processing
    await supabase
      .from("import_progress")
      .update({
        success_count: progressTracker.success,
        error_count: progressTracker.errors,
      })
      .eq("session_id", sessionId);

    // Delay between files (reduced since we have parallelism across closers)
    await new Promise(resolve => setTimeout(resolve, fileDelayMs));
  }

  return userResult;
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
    const maxFilesPerUser = body.maxFilesPerUser || 10;
    const targetUserId = body.userId; // Optional: process only specific user
    const resetErrors = body.resetErrors !== false; // Default true: reset error files to pending first
    const parallelClosers = body.parallelClosers || 3; // Number of closers to process in parallel
    const fileDelayMs = body.fileDelayMs || 5000; // Delay between files (reduced from 10s to 5s)

    console.log(`Starting batch processing. Max files/user: ${maxFilesPerUser}, Target: ${targetUserId || 'all'}, Parallel closers: ${parallelClosers}, File delay: ${fileDelayMs}ms`);

    // Get all users with Google connected
    let usersQuery = supabase
      .from("profiles")
      .select("user_id, full_name, google_connected, google_access_token")
      .eq("google_connected", true);

    if (targetUserId) {
      usersQuery = usersQuery.eq("user_id", targetUserId);
    }

    const { data: usersData, error: usersError } = await usersQuery;

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const users = usersData as User[] | null;

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: "No users with Google connected", results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${users.length} users with Google connected`);

    // Reset error files to pending if requested (except chat transcriptions and empty docs)
    if (resetErrors) {
      const { data: errorFiles, error: resetError } = await supabase
        .from("imported_files")
        .update({ status: "pending", error_message: null })
        .eq("status", "error")
        .not("error_message", "ilike", "%chat%")
        .not("error_message", "ilike", "%transcrição do chat%")
        .not("error_message", "ilike", "%vazio%")
        .select("id");

      if (resetError) {
        console.error("Failed to reset error files:", resetError);
      } else {
        console.log(`Reset ${errorFiles?.length || 0} error files to pending`);
      }
    }

    // Count total pending files for progress tracking
    const { count: totalPendingCount } = await supabase
      .from("imported_files")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const totalPending = totalPendingCount || 0;

    // Create progress tracking record
    const sessionId = crypto.randomUUID();
    console.log(`Creating progress session: ${sessionId}, total files: ${totalPending}`);

    const { error: progressInsertError } = await supabase
      .from("import_progress")
      .insert({
        session_id: sessionId,
        total_files: totalPending,
        processed_files: 0,
        success_count: 0,
        error_count: 0,
        status: "running",
      });

    if (progressInsertError) {
      console.error("Failed to create progress record:", progressInsertError);
    }

    const results: UserResult[] = [];

    // Shared progress tracker (safe in JS single-threaded environment)
    const progressTracker: ProgressTracker = { processed: 0, success: 0, errors: 0 };

    // Divide users into batches for parallel processing
    const userBatches: User[][] = [];
    for (let i = 0; i < users.length; i += parallelClosers) {
      userBatches.push(users.slice(i, i + parallelClosers));
    }

    console.log(`Processing ${users.length} users in ${userBatches.length} batch(es) of up to ${parallelClosers} parallel`);

    for (let batchIndex = 0; batchIndex < userBatches.length; batchIndex++) {
      const batch = userBatches[batchIndex];
      console.log(`Starting batch ${batchIndex + 1}/${userBatches.length} with ${batch.length} users: ${batch.map(u => u.full_name).join(", ")}`);

      // Process all users in this batch in parallel
      const batchResults = await Promise.all(
        batch.map(user =>
          processUserFiles(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
            supabase,
            user,
            maxFilesPerUser,
            sessionId,
            progressTracker,
            fileDelayMs
          )
        )
      );

      // Collect non-null results
      for (const result of batchResults) {
        if (result) {
          results.push(result);
        }
      }

      console.log(`Batch ${batchIndex + 1} complete. Progress: ${progressTracker.processed} processed, ${progressTracker.success} success, ${progressTracker.errors} errors`);
    }

    // Calculate totals from progressTracker
    const totalProcessed = progressTracker.processed;
    const totalSuccess = progressTracker.success;
    const totalErrors = progressTracker.errors;

    // Get remaining pending count
    const { count: remainingPending } = await supabase
      .from("imported_files")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Mark progress as completed
    await supabase
      .from("import_progress")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        current_file_name: null,
        current_closer_name: null,
        processed_files: totalProcessed,
        success_count: totalSuccess,
        error_count: totalErrors,
      })
      .eq("session_id", sessionId);

    console.log(`Batch complete. Processed: ${totalProcessed}, Success: ${totalSuccess}, Errors: ${totalErrors}, Remaining: ${remainingPending}`);

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        summary: {
          usersProcessed: results.length,
          totalProcessed,
          totalSuccess,
          totalErrors,
          remainingPending: remainingPending || 0,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-pending-files:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
