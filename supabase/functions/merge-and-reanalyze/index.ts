import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { primaryCallId, secondaryCallId } = await req.json();

    if (!primaryCallId || !secondaryCallId) {
      return new Response(
        JSON.stringify({ error: "primaryCallId and secondaryCallId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Merging calls: primary=${primaryCallId}, secondary=${secondaryCallId}`);

    // 1. Fetch both calls
    const { data: calls, error: fetchError } = await supabase
      .from("calls")
      .select("*")
      .in("id", [primaryCallId, secondaryCallId]);

    if (fetchError) {
      console.error("Error fetching calls:", fetchError);
      throw new Error("Failed to fetch calls");
    }

    if (!calls || calls.length !== 2) {
      throw new Error("Could not find both calls");
    }

    const primaryCall = calls.find((c) => c.id === primaryCallId);
    const secondaryCall = calls.find((c) => c.id === secondaryCallId);

    if (!primaryCall || !secondaryCall) {
      throw new Error("Could not find both calls");
    }

    // Check if both have transcriptions
    if (!primaryCall.transcription && !secondaryCall.transcription) {
      throw new Error("At least one call must have a transcription");
    }

    console.log(`Primary call: ${primaryCall.client_name}, date: ${primaryCall.call_date}`);
    console.log(`Secondary call: ${secondaryCall.client_name}, date: ${secondaryCall.call_date}`);

    // 2. Combine transcriptions chronologically
    const orderedCalls = [primaryCall, secondaryCall].sort(
      (a, b) => new Date(a.call_date).getTime() - new Date(b.call_date).getTime()
    );

    const combinedTranscription = orderedCalls
      .filter((c) => c.transcription)
      .map((c, i) => {
        const callNum = i + 1;
        const date = c.call_date;
        return `=== CALL ${callNum} (${date}) ===\n\n${c.transcription}`;
      })
      .join("\n\n--- SEPARAÇÃO ENTRE CALLS ---\n\n");

    console.log("Combined transcription length:", combinedTranscription.length);

    // 3. Call analyze-call with combined transcription
    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        transcription: combinedTranscription,
        clientName: primaryCall.client_name,
        product: primaryCall.product || secondaryCall.product,
        isMergedCall: true,
      }),
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error("Analyze call error:", errorText);
      throw new Error("Failed to analyze combined calls");
    }

    const analyzeResult = await analyzeResponse.json();
    console.log("Analysis result:", analyzeResult.success ? "Success" : "Failed");

    if (!analyzeResult.success || !analyzeResult.analysis) {
      throw new Error("Analysis did not return valid results");
    }

    const analysis = analyzeResult.analysis;

    // 4. Update primary call with new combined analysis
    const { error: updatePrimaryError } = await supabase
      .from("calls")
      .update({
        score: Math.round(analysis.call_score),
        technical_analysis: analysis.technical_analysis,
        ai_summary: analysis.ai_summary,
        main_errors: analysis.main_errors,
        main_wins: analysis.main_wins,
        consciousness_level: analysis.consciousness_level,
        decision_reason: analysis.decision_reason,
        lead_classification: analysis.lead_classification,
        loss_point: analysis.loss_point,
        closer_classification: analysis.closer_classification,
        analyzed_at: new Date().toISOString(),
        observation: `Call combinada com outra call (${secondaryCall.call_date}). Análise feita em conjunto.`,
      })
      .eq("id", primaryCallId);

    if (updatePrimaryError) {
      console.error("Error updating primary call:", updatePrimaryError);
      throw new Error("Failed to update primary call");
    }

    // 5. Mark secondary call as merged
    const { error: updateSecondaryError } = await supabase
      .from("calls")
      .update({
        merged_with_call_id: primaryCallId,
        observation: `Call mesclada com call principal (${primaryCall.call_date}). Nota combinada: ${Math.round(analysis.call_score)}`,
      })
      .eq("id", secondaryCallId);

    if (updateSecondaryError) {
      console.error("Error updating secondary call:", updateSecondaryError);
      throw new Error("Failed to update secondary call");
    }

    console.log("Merge complete. New score:", analysis.call_score);

    return new Response(
      JSON.stringify({
        success: true,
        newScore: analysis.call_score,
        primaryCallId,
        secondaryCallId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in merge-and-reanalyze:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
