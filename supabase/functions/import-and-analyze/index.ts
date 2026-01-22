import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to safely convert to integer
const toInt = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value === 'nao_informado' || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : Math.round(num);
  }
  const num = Number(value);
  return isNaN(num) ? null : Math.round(num);
};

// Helper function to safely convert to number
const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value === 'nao_informado' || value === '') return null;
    const num = parseFloat(value.replace(/[^\d.-]/g, ''));
    return isNaN(num) ? null : num;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
};

// Helper function to safely convert boolean
const toBool = (value: unknown): boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'sim' || value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'nao' || value.toLowerCase() === 'não' || value.toLowerCase() === 'false') return false;
  }
  return null;
};

// Extract date from filename pattern: "xxx (2026-01-06 18:29 GMT-3) - Transcript"
const extractDateFromFileName = (name: string): string => {
  const dateMatch = name.match(/\((\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/);
  if (dateMatch && dateMatch[1]) {
    return dateMatch[1];
  }
  return new Date().toISOString().split("T")[0];
};

// Safe JSON parser that handles empty/truncated responses
async function safeReadJson(response: Response): Promise<{ data: unknown; error: string | null }> {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      console.error("Empty response received");
      return { data: null, error: "Empty response from function" };
    }
    try {
      const data = JSON.parse(text);
      return { data, error: null };
    } catch (parseError) {
      console.error("JSON parse error:", parseError, "Raw text (first 500 chars):", text.substring(0, 500));
      return { data: { __raw: text }, error: `JSON parse error: ${parseError}` };
    }
  } catch (readError) {
    console.error("Failed to read response:", readError);
    return { data: null, error: `Failed to read response: ${readError}` };
  }
}

// Helper function to generate SHA-256 hash from content
async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return contentHash;
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
  
  let userId: string | null = null;
  let fileId: string | null = null;
  let fileName: string | null = null;
  let importRecordId: string | null = null;

  try {
    const body = await req.json();
    userId = body.userId;
    fileId = body.fileId;
    fileName = body.fileName;
    
    if (!userId || !fileId) {
      return new Response(
        JSON.stringify({ error: "userId and fileId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if file was already imported or is being processed (prevent race conditions)
    const { data: existingImport } = await supabase
      .from("imported_files")
      .select("id, status, started_processing_at")
      .eq("user_id", userId)
      .eq("drive_file_id", fileId)
      .maybeSingle();

    // Block if already completed
    if (existingImport?.status === "completed") {
      return new Response(
        JSON.stringify({ 
          error: "File already imported", 
          alreadyImported: true
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if currently being processed - allow retry if stuck for more than 5 minutes
    // If called from process-user-files (via header), bypass the processing check
    if (existingImport?.status === "processing") {
      const startedAt = existingImport.started_processing_at;
      const calledFromProcessor = req.headers.get('x-processor-call') === 'true';
      
      // If called from the coordinated processor, always allow (it manages its own lock)
      if (!calledFromProcessor && startedAt) {
        const minutesAgo = (Date.now() - new Date(startedAt).getTime()) / 60000;
        if (minutesAgo < 5) {
          return new Response(
            JSON.stringify({ 
              error: "File is being processed", 
              alreadyProcessing: true
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // File stuck for >5min, allow retry
        console.log(`File ${fileName} stuck in processing for ${Math.round(minutesAgo)}min, allowing retry`);
      } else if (calledFromProcessor) {
        console.log(`File ${fileName} - processing check bypassed (coordinated call)`);
      }
    }

    // Create or update import record as processing with timestamp
    const { data: importRecord, error: importError } = await supabase
      .from("imported_files")
      .upsert({
        user_id: userId,
        drive_file_id: fileId,
        file_name: fileName || "Unknown",
        status: "processing",
        started_processing_at: new Date().toISOString(),
        imported_at: new Date().toISOString(),
        error_message: null,
      }, { onConflict: "user_id,drive_file_id" })
      .select()
      .single();

    if (importError) {
      console.error("Failed to create import record:", importError);
      throw new Error("Failed to create import record");
    }

    importRecordId = importRecord.id;
    console.log(`Processing file: ${fileName} (${fileId})`);

    // Fetch document content with safe JSON parsing
    const fetchResponse = await fetch(`${SUPABASE_URL}/functions/v1/fetch-drive-document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ userId, fileId }),
    });

    const { data: fetchResult, error: fetchParseError } = await safeReadJson(fetchResponse);

    if (fetchParseError) {
      const errorMsg = `Erro ao ler documento: ${fetchParseError}`;
      console.error(errorMsg);
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: errorMsg, imported_at: new Date().toISOString() })
        .eq("id", importRecordId);
      throw new Error(errorMsg);
    }

    if (!fetchResponse.ok) {
      const errorMsg = (fetchResult as { error?: string })?.error || "Failed to fetch document";
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: errorMsg, imported_at: new Date().toISOString() })
        .eq("id", importRecordId);
      throw new Error(errorMsg);
    }

    const content = (fetchResult as { content?: string })?.content;
    if (!content) {
      const errorMsg = "Documento vazio ou sem conteúdo";
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: errorMsg, imported_at: new Date().toISOString() })
        .eq("id", importRecordId);
      throw new Error(errorMsg);
    }
    
    console.log(`Document fetched, content length: ${content.length}`);

    // Verificar duplicata por hash de conteúdo
    console.log("Generating content hash for deduplication...");
    const contentHash = await generateContentHash(content);
    console.log(`Content hash: ${contentHash.substring(0, 16)}...`);

    // Verificar se já existe call com mesmo hash para este closer
    const { data: existingCallByHash } = await supabase
      .from("calls")
      .select("id, client_id, client_name, call_date")
      .eq("closer_id", userId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existingCallByHash) {
      console.log(`⚠️ Call já existe com mesmo conteúdo (hash: ${contentHash.substring(0, 16)}...)`);
      console.log(`Existing call ID: ${existingCallByHash.id}, cliente: ${existingCallByHash.client_name}`);

      // Marcar arquivo como completo, apontando para call existente
      await supabase
        .from("imported_files")
        .update({
          status: "completed",
          call_id: existingCallByHash.id,
          imported_at: new Date().toISOString(),
          started_processing_at: null,
        })
        .eq("id", importRecordId);

      return new Response(
        JSON.stringify({
          success: true,
          callId: existingCallByHash.id,
          clientId: existingCallByHash.client_id,
          deduplicated: true,
          message: `Call duplicada detectada por hash de conteúdo. Vinculada à call existente: ${existingCallByHash.client_name} (${existingCallByHash.call_date})`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("No duplicate found by content hash, proceeding with analysis...");

    // Analyze the call with safe JSON parsing
    const analyzeResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-call`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ transcription: content, fileName }),
    });

    const { data: analyzeResult, error: analyzeParseError } = await safeReadJson(analyzeResponse);

    if (analyzeParseError) {
      const errorMsg = `Erro ao analisar call: ${analyzeParseError}`;
      console.error(errorMsg);
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: errorMsg, imported_at: new Date().toISOString() })
        .eq("id", importRecordId);
      throw new Error(errorMsg);
    }

    if (!analyzeResponse.ok) {
      const errorMsg = (analyzeResult as { error?: string })?.error || "Failed to analyze call";
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: errorMsg, imported_at: new Date().toISOString() })
        .eq("id", importRecordId);
      throw new Error(errorMsg);
    }

    const analysis = (analyzeResult as { analysis?: Record<string, unknown> })?.analysis;
    if (!analysis) {
      const errorMsg = "Análise retornou vazia";
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: errorMsg, imported_at: new Date().toISOString() })
        .eq("id", importRecordId);
      throw new Error(errorMsg);
    }
    
    console.log("Analysis complete:", analysis.client_name);

    // Check if client exists or create new one
    let clientId: string | null = null;
    const clientName = analysis.client_name && analysis.client_name !== 'nao_informado' 
      ? analysis.client_name as string
      : `Lead - ${extractDateFromFileName(fileName || "")}`;
    
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("closer_id", userId)
      .ilike("name", clientName)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
      // Update client with latest data from analysis
      const { error: updateError } = await supabase
        .from("clients")
        .update({
          niche: analysis.niche && analysis.niche !== 'nao_informado' ? analysis.niche : null,
          revenue: toNumber(analysis.revenue),
          has_partner: toBool(analysis.has_partner),
          main_difficulty: analysis.main_difficulty && analysis.main_difficulty !== 'nao_informado' ? analysis.main_difficulty : null,
          main_pain: analysis.main_pain && analysis.main_pain !== 'nao_informado' ? analysis.main_pain : null,
          source: "google_drive",
        })
        .eq("id", clientId);
      
      if (updateError) {
        console.error("Failed to update client:", updateError);
      }
    } else {
      // Create new client
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          closer_id: userId,
          name: clientName,
          niche: analysis.niche && analysis.niche !== 'nao_informado' ? analysis.niche : null,
          revenue: toNumber(analysis.revenue),
          has_partner: toBool(analysis.has_partner),
          main_difficulty: analysis.main_difficulty && analysis.main_difficulty !== 'nao_informado' ? analysis.main_difficulty : null,
          main_pain: analysis.main_pain && analysis.main_pain !== 'nao_informado' ? analysis.main_pain : null,
          source: "google_drive",
        })
        .select()
        .single();

      if (clientError) {
        console.error("Failed to create client:", clientError);
        // Continue anyway - we can still create the call without a client reference
      } else {
        clientId = newClient.id;
      }
    }

    // Determine status based on classification
    const callStatus = analysis.lead_classification === "pos_venda" ? "vendido" : "follow_up";
    const callDate = extractDateFromFileName(fileName || "");
    console.log(`Extracted call date: ${callDate} from file: ${fileName}`);

    // Create or update call record using upsert to prevent duplicates (unique constraint on source_file_id)
    const { data: callRecord, error: callError } = await supabase
      .from("calls")
      .upsert({
        closer_id: userId,
        client_id: clientId,
        client_name: clientName,
        call_date: callDate,
        status: callStatus,
        product: analysis.product && analysis.product !== 'nao_informado' ? analysis.product : null,
        transcription: content,
        content_hash: contentHash,
        score: toInt(analysis.call_score),
        duration_minutes: toInt(analysis.duration_minutes),
        niche: analysis.niche && analysis.niche !== 'nao_informado' ? analysis.niche : null,
        has_partner: toBool(analysis.has_partner),
        main_difficulty: analysis.main_difficulty && analysis.main_difficulty !== 'nao_informado' ? analysis.main_difficulty : null,
        main_pain: analysis.main_pain && analysis.main_pain !== 'nao_informado' ? analysis.main_pain : null,
        consciousness_level: analysis.consciousness_level && analysis.consciousness_level !== 'nao_informado' ? analysis.consciousness_level : null,
        decision_reason: analysis.decision_reason && analysis.decision_reason !== 'nao_informado' ? analysis.decision_reason : null,
        ai_summary: analysis.ai_summary,
        lead_classification: analysis.lead_classification,
        closer_classification: analysis.closer_classification,
        technical_analysis: analysis.technical_analysis,
        analysis_metadata: (analysis as { analysis_metadata?: unknown }).analysis_metadata || {},
        main_errors: analysis.main_errors,
        main_wins: analysis.main_wins,
        loss_point: analysis.loss_point && analysis.loss_point !== 'nao_informado' ? analysis.loss_point : null,
        next_contact_date: analysis.next_contact_date,
        entry_value: toNumber(analysis.entry_value),
        sale_value: toNumber(analysis.sale_value),
        source_file_id: fileId,
        analyzed_at: new Date().toISOString(),
      }, { 
        onConflict: "source_file_id",  // Prevents duplicates - updates if file already exists
        ignoreDuplicates: false        // Update existing record with new data
      })
      .select()
      .single();

    if (callError) {
      console.error("Failed to create/update call:", callError);
      const errorMsg = `Erro ao criar call: ${callError.message} (code: ${callError.code}, details: ${callError.details || 'none'})`;
      await supabase
        .from("imported_files")
        .update({ status: "error", error_message: errorMsg, imported_at: new Date().toISOString() })
        .eq("id", importRecordId);
      throw new Error(errorMsg);
    }

    // Update import record as completed (clear processing timestamp)
    await supabase
      .from("imported_files")
      .update({ 
        status: "completed", 
        call_id: callRecord.id,
        error_message: null,
        started_processing_at: null,
        imported_at: new Date().toISOString(),
      })
      .eq("id", importRecordId);

    // Create notification for the user
    await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: "Nova call analisada",
        message: `A transcrição de ${clientName} foi analisada. Nota: ${analysis.call_score ?? 'N/A'}/10`,
        type: "info",
      });

    console.log(`Import complete: ${fileName} -> Call ${callRecord.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: callRecord.id,
        clientId,
        analysis: {
          client_name: clientName,
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
    
    // Ensure we always update the import record to error status (clear processing timestamp)
    if (userId && fileId) {
      try {
        await supabase
          .from("imported_files")
          .update({ 
            status: "error", 
            error_message: message,
            started_processing_at: null,
            imported_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("drive_file_id", fileId);
      } catch (updateError) {
        console.error("Failed to update import status to error:", updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
