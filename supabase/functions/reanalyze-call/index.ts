import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callId } = await req.json();

    if (!callId) {
      return new Response(
        JSON.stringify({ error: 'callId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reanalyze-call] Iniciando reanálise da call: ${callId}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the call with transcription
    const { data: call, error: fetchError } = await supabase
      .from('calls')
      .select('id, transcription, client_name')
      .eq('id', callId)
      .single();

    if (fetchError) {
      console.error('[reanalyze-call] Erro ao buscar call:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Call não encontrada', details: fetchError.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!call.transcription) {
      console.error('[reanalyze-call] Call não possui transcrição');
      return new Response(
        JSON.stringify({ error: 'Esta call não possui transcrição para analisar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reanalyze-call] Transcrição encontrada. Chamando analyze-call...`);

    // Call the analyze-call edge function
    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ transcription: call.transcription }),
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error('[reanalyze-call] Erro ao chamar analyze-call:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao analisar call', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisResult = await analyzeResponse.json();
    console.log('[reanalyze-call] Análise concluída com sucesso');
    console.log('[reanalyze-call] analysisResult keys:', Object.keys(analysisResult));

    // Extract the analysis object - analyze-call returns { success, analysis: { technical_analysis, ... } }
    const analysis = analysisResult.analysis || analysisResult;
    console.log('[reanalyze-call] analysis keys:', Object.keys(analysis));

    // Update the call with new analysis
    // IMPORTANT: save technical_analysis from the nested analysis.technical_analysis
    const updateData: Record<string, unknown> = {
      technical_analysis: analysis.technical_analysis || analysis,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Extract summary fields from the analysis object
    if (analysis) {
      // Score from call_score or nota_geral
      if (analysis.call_score !== undefined) {
        updateData.score = typeof analysis.call_score === 'string' 
          ? parseInt(analysis.call_score, 10) 
          : analysis.call_score;
      } else if (analysis.nota_geral !== undefined) {
        updateData.score = analysis.nota_geral;
      }
      
      // Main errors and wins (arrays of strings)
      if (analysis.main_errors) updateData.main_errors = analysis.main_errors;
      if (analysis.main_wins) updateData.main_wins = analysis.main_wins;
      
      // Loss point
      if (analysis.loss_point) updateData.loss_point = analysis.loss_point;
      
      // Additional fields
      if (analysis.niche) updateData.niche = analysis.niche;
      if (analysis.main_pain) updateData.main_pain = analysis.main_pain;
      if (analysis.main_difficulty) updateData.main_difficulty = analysis.main_difficulty;
      if (analysis.ai_summary) updateData.ai_summary = analysis.ai_summary;
      
      // Call conclusion from sold field
      if (analysis.sold !== undefined) {
        updateData.call_conclusion = analysis.sold === true || analysis.sold === 'sim' ? 'vendeu' : 'nao_vendeu';
      }
      
      // Fallback: extract from nested identificacao/dados_extraidos if direct fields not available
      if (analysis.identificacao) {
        if (analysis.identificacao.houve_venda && analysis.identificacao.houve_venda !== 'nao_informado' && !updateData.call_conclusion) {
          updateData.call_conclusion = analysis.identificacao.houve_venda === 'sim' ? 'vendeu' : 'nao_vendeu';
        }
      }
      
      if (analysis.dados_extraidos) {
        const dados = analysis.dados_extraidos;
        if (dados.nicho_profissao && dados.nicho_profissao !== 'nao_informado' && !updateData.niche) {
          updateData.niche = dados.nicho_profissao;
        }
        if (dados.dor_principal_declarada?.texto && dados.dor_principal_declarada.texto !== 'nao_informado' && !updateData.main_pain) {
          updateData.main_pain = dados.dor_principal_declarada.texto;
        }
        if (dados.dor_profunda?.texto && dados.dor_profunda.texto !== 'nao_informado' && !updateData.main_difficulty) {
          updateData.main_difficulty = dados.dor_profunda.texto;
        }
      }
      
      // Justificativa da nota como resumo (fallback)
      if (!updateData.ai_summary && analysis.justificativa_nota_geral && Array.isArray(analysis.justificativa_nota_geral)) {
        updateData.ai_summary = analysis.justificativa_nota_geral.join(' | ');
      }
    }
    
    console.log('[reanalyze-call] updateData keys:', Object.keys(updateData));

    const { error: updateError } = await supabase
      .from('calls')
      .update(updateData)
      .eq('id', callId);

    if (updateError) {
      console.error('[reanalyze-call] Erro ao atualizar call:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar análise', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reanalyze-call] Call ${callId} atualizada com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Call reanalisada com sucesso',
        callId,
        clientName: call.client_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[reanalyze-call] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
