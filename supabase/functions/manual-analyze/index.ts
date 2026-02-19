import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request
    const { transcription, closerId, clientName, callDate } = await req.json();

    if (!transcription || !closerId || !clientName) {
      return new Response(JSON.stringify({ error: "Missing required fields: transcription, closerId, clientName" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transcription.length < 500) {
      return new Response(JSON.stringify({ error: "Transcrição muito curta (mínimo 500 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Manual analysis requested by admin ${userId} for closer ${closerId}, client: ${clientName}`);

    // Call analyze-call function
    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        transcription,
        fileName: `Manual - ${clientName}`,
        userId: closerId,
      }),
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error("analyze-call error:", analyzeResponse.status, errorText);

      if (analyzeResponse.status === 408) {
        return new Response(JSON.stringify({
          error: `Timeout na análise: a transcrição tem ${transcription.length.toLocaleString('pt-BR')} caracteres e excedeu o tempo limite. Tente novamente — o sistema usará modo por partes automaticamente para transcrições longas.`
        }), {
          status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro na análise da transcrição" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analyzeResult = await analyzeResponse.json();

    if (!analyzeResult.success || !analyzeResult.analysis) {
      return new Response(JSON.stringify({ error: analyzeResult.error || "Análise retornou resultado inválido" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = analyzeResult.analysis;

    // Determine call status — must match call_status enum: pos_venda, follow_up, perdido, agendamento, sem_perfil
    let callStatus = "follow_up";
    if (analysis.sold === "sim") callStatus = "vendido";
    else callStatus = "follow_up";

    // Map lead_classification
    const leadClassification = analysis.lead_classification || "follow";
    const validLeadClassifications = ["pos_venda", "follow", "perdido", "agendamento", "sem_perfil"];
    const finalLeadClassification = validLeadClassifications.includes(leadClassification) ? leadClassification : "follow";

    // Map closer_classification
    const closerClassification = analysis.closer_classification || "intermediario";
    const validCloserClassifications = ["elite", "alta_performance", "avancado", "intermediario", "iniciante"];
    const finalCloserClassification = validCloserClassifications.includes(closerClassification) ? closerClassification : "intermediario";

    // Insert call using service role (bypasses RLS)
    const { data: callData, error: insertError } = await serviceClient
      .from("calls")
      .insert({
        closer_id: closerId,
        client_name: analysis.client_name || clientName,
        call_date: callDate || new Date().toISOString().split("T")[0],
        status: callStatus,
        score: analysis.call_score != null ? Math.round(Number(analysis.call_score)) : null,
        product: analysis.product || null,
        niche: analysis.niche || null,
        main_pain: analysis.main_pain || null,
        main_difficulty: analysis.main_difficulty || null,
        ai_summary: analysis.ai_summary || null,
        technical_analysis: analysis.technical_analysis || null,
        analysis_metadata: analysis.analysis_metadata || null,
        main_errors: analysis.main_errors || null,
        main_wins: analysis.main_wins || null,
        loss_point: analysis.loss_point || null,
        lead_classification: finalLeadClassification,
        closer_classification: finalCloserClassification,
        consciousness_level: analysis.consciousness_level || null,
        decision_reason: analysis.decision_reason || null,
        has_partner: analysis.has_partner || null,
        transcription,
        analyzed_at: new Date().toISOString(),
        notes: `Análise manual por admin em ${new Date().toLocaleDateString("pt-BR")}`,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar call: " + insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Call created successfully: ${callData.id}, score: ${analysis.call_score}`);

    return new Response(
      JSON.stringify({
        success: true,
        callId: callData.id,
        score: analysis.call_score,
        clientName: analysis.client_name || clientName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("manual-analyze error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
