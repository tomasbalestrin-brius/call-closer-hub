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

// Process a single file with retry logic for rate limits
async function processWithRetry(
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  fileId: string,
  fileName: string,
  maxRetries = 5
): Promise<{ success: boolean; result?: unknown; error?: string; alreadyImported?: boolean }> {
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} for file: ${fileName}`);
      
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
      });

      const { data: result, error: parseError } = await safeReadJson(response);

      // Check for rate limit errors
      const resultObj = result as { error?: string; alreadyImported?: boolean } | null;
      const isRateLimit = 
        response.status === 429 || 
        parseError?.includes("Rate limit") ||
        resultObj?.error?.includes("Rate limit") ||
        resultObj?.error?.includes("rate limit");

      if (isRateLimit) {
        // Exponential backoff: 10s, 20s, 40s, 80s, 160s
        const waitTime = Math.min(10000 * Math.pow(2, attempt - 1), 180000); 
        console.log(`Rate limit hit on attempt ${attempt}. Waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // Check for empty response (might be timeout)
      if (parseError === "Empty response from function") {
        const waitTime = attempt * 5000; // 5s, 10s, 15s, 20s, 25s
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

    console.log(`Starting batch processing. Max files per user: ${maxFilesPerUser}, Target user: ${targetUserId || 'all'}`);

    // Get all users with Google connected
    let usersQuery = supabase
      .from("profiles")
      .select("user_id, full_name, google_connected, google_access_token")
      .eq("google_connected", true);

    if (targetUserId) {
      usersQuery = usersQuery.eq("user_id", targetUserId);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

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

    const results: Array<{
      userId: string;
      userName: string;
      pendingBefore: number;
      processed: number;
      success: number;
      errors: number;
      details: Array<{ fileName: string; success: boolean; error?: string }>;
    }> = [];

    let globalProcessed = 0;
    let globalSuccess = 0;
    let globalErrors = 0;

    for (const user of users) {
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
        results.push({
          userId: user.user_id,
          userName: user.full_name,
          pendingBefore: 0,
          processed: 0,
          success: 0,
          errors: 1,
          details: [{ fileName: "N/A", success: false, error: pendingError.message }],
        });
        continue;
      }

      if (!pendingFiles || pendingFiles.length === 0) {
        console.log(`No pending files for ${user.full_name}`);
        continue;
      }

      console.log(`Processing ${pendingFiles.length} files for ${user.full_name}`);

      const userResult = {
        userId: user.user_id,
        userName: user.full_name,
        pendingBefore: pendingFiles.length,
        processed: 0,
        success: 0,
        errors: 0,
        details: [] as Array<{ fileName: string; success: boolean; error?: string }>,
      };

      for (const file of pendingFiles) {
        console.log(`Processing: ${file.file_name}`);

        // Update progress BEFORE processing
        globalProcessed++;
        await supabase
          .from("import_progress")
          .update({
            processed_files: globalProcessed,
            success_count: globalSuccess,
            error_count: globalErrors,
            current_file_name: file.file_name,
            current_closer_name: user.full_name,
          })
          .eq("session_id", sessionId);

        // Process with retry logic
        const processResult = await processWithRetry(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          user.user_id,
          file.drive_file_id,
          file.file_name
        );

        userResult.processed++;

        if (processResult.success) {
          if (processResult.alreadyImported) {
            console.log(`File already imported: ${file.file_name}`);
          } else {
            console.log(`Successfully processed: ${file.file_name}`);
          }
          userResult.success++;
          globalSuccess++;
          userResult.details.push({
            fileName: file.file_name,
            success: true,
          });
        } else {
          console.error(`Error processing ${file.file_name}:`, processResult.error);
          userResult.errors++;
          globalErrors++;
          userResult.details.push({
            fileName: file.file_name,
            success: false,
            error: processResult.error?.substring(0, 200),
          });
        }

        // Update progress AFTER processing
        await supabase
          .from("import_progress")
          .update({
            success_count: globalSuccess,
            error_count: globalErrors,
          })
          .eq("session_id", sessionId);

        // Increased delay between files to avoid rate limiting (10 seconds)
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      results.push(userResult);
    }

    // Calculate totals
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

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
        processed_files: globalProcessed,
        success_count: globalSuccess,
        error_count: globalErrors,
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
