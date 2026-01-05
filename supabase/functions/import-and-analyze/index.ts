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

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Server configuration error");
    }

    const { userId, fileId, fileName } = await req.json();
    
    if (!userId || !fileId) {
      return new Response(
        JSON.stringify({ error: "userId and fileId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if file was already imported
    const { data: existingImport } = await supabase
      .from("imported_files")
      .select("id, status")
      .eq("user_id", userId)
      .eq("drive_file_id", fileId)
      .single();

    if (existingImport) {
      if (existingImport.status === "completed") {
        return new Response(
          JSON.stringify({ error: "File already imported", alreadyImported: true }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // If pending or error, we'll retry
    }

    // Create or update import record as processing
    const { data: importRecord, error: importError } = await supabase
      .from("imported_files")
      .upsert({
        user_id: userId,
        drive_file_id: fileId,
        file_name: fileName || "Unknown",
        status: "processing",
      }, { onConflict: "user_id,drive_file_id" })
      .select()
      .single();

    if (importError) {
      console.error("Failed to create import record:", importError);
      throw new Error("Failed to create import record");
    }

    console.log(`Processing file: ${fileName} (${fileId})`);

    // Fetch document content
    const fetchResponse = await fetch(`${SUPABASE_URL}/functions/v1/fetch-drive-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ userId, fileId }),
    });

    if (!fetchResponse.ok) {
      const error = await fetchResponse.json();
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: error.error || "Failed to fetch document" })
        .eq("id", importRecord.id);
      throw new Error(error.error || "Failed to fetch document");
    }

    const { content } = await fetchResponse.json();
    console.log(`Document fetched, content length: ${content.length}`);

    // Analyze the call
    const analyzeResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ transcription: content, fileName }),
    });

    if (!analyzeResponse.ok) {
      const error = await analyzeResponse.json();
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: error.error || "Failed to analyze call" })
        .eq("id", importRecord.id);
      throw new Error(error.error || "Failed to analyze call");
    }

    const { analysis } = await analyzeResponse.json();
    console.log("Analysis complete:", analysis.client_name);

    // Check if client exists or create new one
    let clientId: string | null = null;
    
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("closer_id", userId)
      .ilike("name", analysis.client_name)
      .single();

    if (existingClient) {
      clientId = existingClient.id;
      // Update client with latest data from analysis
      await supabase
        .from("clients")
        .update({
          niche: analysis.niche,
          revenue: analysis.revenue,
          has_partner: analysis.has_partner,
          main_difficulty: analysis.main_difficulty,
          main_pain: analysis.main_pain,
          source: "google_drive",
        })
        .eq("id", clientId);
    } else {
      // Create new client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          closer_id: userId,
          name: analysis.client_name,
          niche: analysis.niche,
          revenue: analysis.revenue,
          has_partner: analysis.has_partner,
          main_difficulty: analysis.main_difficulty,
          main_pain: analysis.main_pain,
          source: "google_drive",
        })
        .select()
        .single();

      if (clientError) {
        console.error("Failed to create client:", clientError);
      } else {
        clientId = newClient.id;
      }
    }

    // Determine status based on classification
    const callStatus = analysis.lead_classification === "pos_venda" ? "vendido" : "follow_up";

    // Create call record
    const { data: callRecord, error: callError } = await supabase
      .from("calls")
      .insert({
        closer_id: userId,
        client_id: clientId,
        client_name: analysis.client_name,
        call_date: new Date().toISOString().split("T")[0],
        status: callStatus,
        product: analysis.product,
        transcription: content,
        score: analysis.call_score,
        niche: analysis.niche,
        has_partner: analysis.has_partner,
        main_difficulty: analysis.main_difficulty,
        main_pain: analysis.main_pain,
        consciousness_level: analysis.consciousness_level,
        decision_reason: analysis.decision_reason,
        ai_summary: analysis.ai_summary,
        lead_classification: analysis.lead_classification,
        closer_classification: analysis.closer_classification,
        technical_analysis: analysis.technical_analysis,
        main_errors: analysis.main_errors,
        main_wins: analysis.main_wins,
        loss_point: analysis.loss_point,
        next_contact_date: analysis.next_contact_date,
        source_file_id: fileId,
        analyzed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (callError) {
      console.error("Failed to create call:", callError);
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: "Failed to create call record" })
        .eq("id", importRecord.id);
      throw new Error("Failed to create call record");
    }

    // Update import record as completed
    await supabase
      .from("imported_files")
      .update({ 
        status: "completed", 
        call_id: callRecord.id,
        error_message: null,
      })
      .eq("id", importRecord.id);

    // Create notification for the user
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: "Nova call analisada",
        message: `A transcrição de ${analysis.client_name} foi analisada. Nota: ${analysis.call_score}/10`,
        type: "info",
      });

    console.log(`Import complete: ${fileName} -> Call ${callRecord.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: callRecord.id,
        clientId,
        analysis: {
          client_name: analysis.client_name,
          call_score: analysis.call_score,
          lead_classification: analysis.lead_classification,
          closer_classification: analysis.closer_classification,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in import-and-analyze:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
