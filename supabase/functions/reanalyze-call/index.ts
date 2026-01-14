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

    // Update the call with new analysis
    const updateData: Record<string, unknown> = {
      technical_analysis: analysisResult.analysis || analysisResult,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Extract summary fields from new schema (campos na raiz do JSON)
    const analysis = analysisResult.analysis || analysisResult;
    if (analysis) {
      // Nota geral
      if (analysis.nota_geral !== undefined) updateData.score = analysis.nota_geral;
      
      // Maiores erros (array de objetos com erro, evidencia, impacto, etc.)
      if (analysis.maiores_erros) updateData.main_errors = analysis.maiores_erros;
      
      // Maiores acertos (array de objetos com acerto, evidencia, etc.)
      if (analysis.maiores_acertos) updateData.main_wins = analysis.maiores_acertos;
      
      // Ponto de perda da venda
      if (analysis.ponto_de_perda_da_venda) updateData.loss_point = analysis.ponto_de_perda_da_venda;
      
      // Dados de identificação
      if (analysis.identificacao) {
        if (analysis.identificacao.nome_lead && analysis.identificacao.nome_lead !== 'nao_informado') {
          // Client name já vem do registro, não sobrescrever
        }
        if (analysis.identificacao.houve_venda && analysis.identificacao.houve_venda !== 'nao_informado') {
          updateData.call_conclusion = analysis.identificacao.houve_venda === 'sim' ? 'vendeu' : 'nao_vendeu';
        }
      }
      
      // Dados extraídos
      if (analysis.dados_extraidos) {
        const dados = analysis.dados_extraidos;
        if (dados.nicho_profissao && dados.nicho_profissao !== 'nao_informado') {
          updateData.niche = dados.nicho_profissao;
        }
        if (dados.dor_principal_declarada?.texto && dados.dor_principal_declarada.texto !== 'nao_informado') {
          updateData.main_pain = dados.dor_principal_declarada.texto;
        }
        if (dados.dor_profunda?.texto && dados.dor_profunda.texto !== 'nao_informado') {
          updateData.main_difficulty = dados.dor_profunda.texto;
        }
      }
      
      // Justificativa da nota como resumo
      if (analysis.justificativa_nota_geral && Array.isArray(analysis.justificativa_nota_geral)) {
        updateData.ai_summary = analysis.justificativa_nota_geral.join(' | ');
      }
    }

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
