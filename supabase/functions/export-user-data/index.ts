import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user from JWT
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { includeDeleted = false, format = 'json' } = await req.json().catch(() => ({}));

    console.log(`Exporting data for user ${user.id}, includeDeleted: ${includeDeleted}, format: ${format}`);

    // Call export function
    const { data: exportData, error: exportError } = await supabase
      .rpc('export_user_data', {
        p_user_id: user.id,
        p_include_deleted: includeDeleted
      });

    if (exportError) {
      console.error("Export error:", exportError);
      throw exportError;
    }

    if (!exportData || exportData.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No data to export",
          exportData: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Exported ${exportData.length} calls`);

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('user_id', user.id)
      .single();

    // Build export object
    const exportObject = {
      exportDate: new Date().toISOString(),
      userId: user.id,
      userEmail: profile?.email || user.email,
      userName: profile?.full_name || "Unknown",
      totalCalls: exportData.length,
      activeCalls: exportData.filter((c: { deleted_at: null | string }) => !c.deleted_at).length,
      deletedCalls: exportData.filter((c: { deleted_at: null | string }) => c.deleted_at).length,
      calls: exportData.map((call: {
        call_id: string;
        client_name: string;
        call_date: string;
        transcription: string;
        analysis: object;
        created_at: string;
        deleted_at: string | null;
      }) => ({
        id: call.call_id,
        clientName: call.client_name,
        callDate: call.call_date,
        transcription: call.transcription,
        transcriptionLength: call.transcription?.length || 0,
        analysis: call.analysis,
        createdAt: call.created_at,
        deletedAt: call.deleted_at,
        isDeleted: !!call.deleted_at
      }))
    };

    // Return based on format
    if (format === 'csv') {
      // Simple CSV export (calls summary only, no transcription)
      const csvHeaders = "ID,Client Name,Call Date,Score,Status,Created At,Deleted At";
      const csvRows = exportData.map((call: {
        call_id: string;
        client_name: string;
        call_date: string;
        analysis: { score?: number; status?: string };
        created_at: string;
        deleted_at: string | null;
      }) => {
        const score = call.analysis?.score || "";
        const status = call.analysis?.status || "";
        return `${call.call_id},"${call.client_name}",${call.call_date},${score},${status},${call.created_at},${call.deleted_at || ""}`;
      });

      const csv = [csvHeaders, ...csvRows].join("\n");

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="call-closer-hub-export-${user.id}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }

    // Default: JSON export
    return new Response(
      JSON.stringify(exportObject, null, 2),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="call-closer-hub-export-${user.id}-${new Date().toISOString().split('T')[0]}.json"`
        }
      }
    );
  } catch (error: unknown) {
    console.error("Error in export-user-data:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
