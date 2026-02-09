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

  const startTime = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Server configuration error");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar todos os closers com auto-import ativo
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("google_connected", true)
      .eq("drive_auto_import", true);

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      console.log("No users with auto-import enabled");
      return new Response(
        JSON.stringify({ success: true, message: "No users to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting auto-sync for ${profiles.length} users`);

    const results: { userId: string; name: string; success: boolean; synced?: number; error?: string }[] = [];

    // Processar sequencialmente para evitar sobrecarga
    for (const profile of profiles) {
      try {
        console.log(`Syncing: ${profile.full_name} (${profile.user_id})`);

        const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/sync-drive-files`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ userId: profile.user_id }),
        });

        const text = await syncResponse.text();
        let result: { synced?: number; error?: string } = {};
        try {
          result = JSON.parse(text);
        } catch {
          result = { error: `Invalid response: ${text.substring(0, 200)}` };
        }

        if (!syncResponse.ok) {
          console.error(`Sync failed for ${profile.full_name}:`, result.error);
          results.push({ userId: profile.user_id, name: profile.full_name, success: false, error: result.error || "Unknown error" });
        } else {
          console.log(`Synced ${profile.full_name}: ${result.synced || 0} files`);
          results.push({ userId: profile.user_id, name: profile.full_name, success: true, synced: result.synced || 0 });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        console.error(`Error syncing ${profile.full_name}:`, msg);
        results.push({ userId: profile.user_id, name: profile.full_name, success: false, error: msg });
      }

      // Delay de 2s entre usuários
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const totalSynced = results.filter(r => r.success).reduce((sum, r) => sum + (r.synced || 0), 0);
    const failedCount = results.filter(r => !r.success).length;
    const durationMs = Date.now() - startTime;

    // Logar resultado no system_logs
    await supabase.rpc("log_event", {
      p_level: failedCount > 0 ? "warn" : "info",
      p_service: "auto-sync-drive",
      p_operation: "cron_sync",
      p_duration_ms: durationMs,
      p_metadata: { users: profiles.length, synced: totalSynced, failed: failedCount },
      p_error_message: failedCount > 0 ? `${failedCount} user(s) failed` : null,
    });

    console.log(`Auto-sync complete: ${totalSynced} files synced, ${failedCount} failures, ${durationMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        users: profiles.length,
        totalSynced,
        failed: failedCount,
        durationMs,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in auto-sync-drive:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
