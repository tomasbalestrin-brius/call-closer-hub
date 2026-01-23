import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheck {
  healthy: boolean;
  message: string;
  details?: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkDatabase(supabase: any): Promise<HealthCheck> {
  try {
    const startTime = Date.now();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const duration = Date.now() - startTime;

    if (error) {
      return {
        healthy: false,
        message: `Database error: ${error.message}`,
        details: { duration_ms: duration }
      };
    }

    return { 
      healthy: true, 
      message: 'OK',
      details: { duration_ms: duration }
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkOpenAI(): Promise<HealthCheck> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    return { healthy: false, message: 'API key not configured' };
  }

  try {
    const startTime = Date.now();
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const duration = Date.now() - startTime;

    if (response.status === 401) {
      return { healthy: false, message: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { 
        healthy: false, 
        message: 'Rate limit exceeded',
        details: { duration_ms: duration }
      };
    }

    return { 
      healthy: response.ok, 
      message: response.ok ? 'OK' : `HTTP ${response.status}`,
      details: { duration_ms: duration }
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkStuckFiles(supabase: any): Promise<HealthCheck> {
  try {
    const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();

    const { count, error } = await supabase
      .from("imported_files")
      .select("*", { count: "exact", head: true })
      .eq("status", "processing")
      .lt("started_processing_at", tenMinutesAgo);

    if (error) {
      return { healthy: false, message: `Query error: ${error.message}` };
    }

    if (count && count > 0) {
      return {
        healthy: false,
        message: `${count} files stuck in processing >10min`,
        details: { stuck_count: count }
      };
    }

    return { healthy: true, message: 'No stuck files', details: { stuck_count: 0 } };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkPendingFilesBacklog(supabase: any): Promise<HealthCheck> {
  try {
    const { count, error } = await supabase
      .from("imported_files")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      return { healthy: false, message: `Query error: ${error.message}` };
    }

    const pendingCount = count || 0;
    const isHealthy = pendingCount < 100; // Alert if >100 pending files

    return {
      healthy: isHealthy,
      message: isHealthy ? 'Queue normal' : `High backlog: ${pendingCount} files pending`,
      details: { pending_count: pendingCount }
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkRecentErrors(supabase: any): Promise<HealthCheck> {
  try {
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const { count, error } = await supabase
      .from("system_logs")
      .select("*", { count: "exact", head: true })
      .in("level", ["error", "critical"])
      .gte("timestamp", oneHourAgo);

    if (error) {
      return { healthy: false, message: `Query error: ${error.message}` };
    }

    const errorCount = count || 0;
    const isHealthy = errorCount < 10; // Alert if >10 errors in last hour

    return {
      healthy: isHealthy,
      message: isHealthy ? 'Error rate normal' : `High error rate: ${errorCount} errors/hour`,
      details: { error_count_1h: errorCount }
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          status: 'unhealthy',
          error: 'Server configuration error',
          timestamp: new Date().toISOString()
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Run all health checks in parallel
    const [database, openai, stuckFiles, pendingBacklog, recentErrors] = await Promise.all([
      checkDatabase(supabase),
      checkOpenAI(),
      checkStuckFiles(supabase),
      checkPendingFilesBacklog(supabase),
      checkRecentErrors(supabase)
    ]);

    const checks = { 
      database, 
      openai, 
      stuck_files: stuckFiles,
      pending_backlog: pendingBacklog,
      recent_errors: recentErrors
    };

    // Consider healthy if core services (database, openai) are healthy
    // Stuck files and backlog are warnings but don't make system unhealthy
    const coreHealthy = database.healthy && openai.healthy;
    const hasWarnings = !stuckFiles.healthy || !pendingBacklog.healthy || !recentErrors.healthy;
    
    const status = coreHealthy 
      ? (hasWarnings ? 'degraded' : 'healthy')
      : 'unhealthy';

    const totalDuration = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        status,
        timestamp: new Date().toISOString(),
        response_time_ms: totalDuration,
        checks
      }),
      {
        status: status === 'unhealthy' ? 503 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        response_time_ms: Date.now() - startTime
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
