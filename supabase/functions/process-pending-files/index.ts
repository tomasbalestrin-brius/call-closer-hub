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

    // Reset error files to pending if requested (except chat transcriptions)
    if (resetErrors) {
      const { data: errorFiles, error: resetError } = await supabase
        .from("imported_files")
        .update({ status: "pending", error_message: null })
        .eq("status", "error")
        .not("error_message", "ilike", "%chat%")
        .not("error_message", "ilike", "%transcrição do chat%")
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

        try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/import-and-analyze`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              userId: user.user_id,
              fileId: file.drive_file_id,
              fileName: file.file_name,
            }),
          });

          const { data: result, error: parseError } = await safeReadJson(response);

          userResult.processed++;

          if (parseError || !response.ok) {
            const errorMsg = parseError || (result as { error?: string })?.error || "Unknown error";
            console.error(`Error processing ${file.file_name}:`, errorMsg);
            userResult.errors++;
            globalErrors++;
            userResult.details.push({
              fileName: file.file_name,
              success: false,
              error: String(errorMsg).substring(0, 200),
            });
          } else if ((result as { alreadyImported?: boolean })?.alreadyImported) {
            console.log(`File already imported: ${file.file_name}`);
            userResult.success++;
            globalSuccess++;
            userResult.details.push({
              fileName: file.file_name,
              success: true,
            });
          } else {
            console.log(`Successfully processed: ${file.file_name}`);
            userResult.success++;
            globalSuccess++;
            userResult.details.push({
              fileName: file.file_name,
              success: true,
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

        } catch (err) {
          console.error(`Exception processing ${file.file_name}:`, err);
          userResult.processed++;
          userResult.errors++;
          globalErrors++;
          userResult.details.push({
            fileName: file.file_name,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });

          // Update progress on error
          await supabase
            .from("import_progress")
            .update({
              error_count: globalErrors,
            })
            .eq("session_id", sessionId);
        }

        // Small delay between files to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
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
