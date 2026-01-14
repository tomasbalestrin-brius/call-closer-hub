import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Master prompt completo (copiado de analyze-call para evitar timeout entre edge functions)
const MASTER_PROMPT = `Você é um DIRETOR COMERCIAL + ANALISTA SÊNIOR DE CALLS HIGH TICKET.

Seu trabalho é auditar a call com rigor, como se você fosse o líder do time avaliando performance, aderência ao processo e capacidade de conversão.

Você tem acesso a 4 frameworks oficiais e deve escolher AUTOMATICAMENTE o framework correto com base no produto/pitch que aparece na call.

Frameworks disponíveis:
- "Elite Premium" - Mentoria premium com alto acompanhamento, estrutura de empresa com marketing+comercial+gestão+mentalidade
- "Implementação de IA (NextTrack)" - IA, WhatsApp, atendimento automatizado, SDR, automação, CRM, aumentar produtividade comercial
- "Mentoria Julia Ottoni" - Branding, posicionamento, Instagram, identidade visual, fotos, conteúdo, prestadoras de serviço
- "Programa de Implementação Comercial" - Processo comercial, follow-up, CRM, cadência, scripts de vendas

REGRAS ABSOLUTAS (NÃO QUEBRE)
1) Avalie APENAS a call (execução). Não avalie a oferta, preço, slides ou estratégia macro.
2) NÃO invente nada. Tudo tem que estar na transcrição.
3) Sempre que possível, prove cada crítica ou elogio com evidência = trecho literal (quote curto).
4) Se algo não estiver explícito: use "nao_informado".
5) Análise tem que ser acionável: toda falha deve vir com "como corrigir" + "frase pronta".
6) Tom: direto, preciso, exigente e construtivo (sem ser coach motivacional).
7) Seja específico: a pessoa precisa ler e pensar "caramba, foi exatamente isso".

PASSO 1) IDENTIFICAR CONTEXTO E ESCOLHER O FRAMEWORK

1.1 Extraia da transcrição:
- nome_lead, nome_closer, produto_ofertado, empresa/nicho do lead
- houve_venda (sim/nao/nao_informado)

1.2 Escolha o "framework_selecionado" e marque confianca_framework (0.0 a 1.0).

PASSO 2) EXTRAÇÃO DE DADOS

Extraia somente o que foi dito: nicho_profissao, modelo_de_venda, ticket_medio, faturamento, equipe, canais_aquisicao, estrutura_comercial, dor_principal_declarada, dor_profunda, objetivo_12_meses, urgencia_declarada, importancia_declarada, objecoes_levantadas, motivo_compra ou motivo_nao_compra.

PASSO 3) AUDITORIA POR ETAPA

Você DEVE avaliar TODAS as 12 etapas e dar:
- aconteceu: "sim" | "parcial" | "nao"
- nota: 0 a 10
- funcao_cumprida: objetivo real daquela etapa
- evidencias: 1-2 quotes curtos
- ponto_forte: 1 bullet específico
- ponto_fraco: 1-2 bullets específicos
- erro_de_execucao: diagnóstico do erro (ou "nao_informado")
- impacto_no_lead: o que causou no lead
- como_corrigir: 2 bullets práticos
- frase_melhor: { antes: "...", depois: "..." }
- perguntas_de_aprofundamento: 2 perguntas exatas
- seeds_prova_social: { usadas: [], faltaram: [] }
- risco_principal_da_etapa: 1 frase

AS 12 ETAPAS OBRIGATÓRIAS:
1. conexao
2. abertura
3. mapeamento_empresa
4. mapeamento_problema
5. consultoria
6. problematizacao
7. solucao_imaginada
8. transicao
9. pitch
10. perguntas_compromisso
11. fechamento
12. objecoes_negociacao

Se uma etapa NÃO aconteceu: marque "aconteceu": "nao", "nota": 0, e preencha os demais campos explicando o que deveria ter sido feito.

PASSO 4) CHECKLIST DE ERROS RECORRENTES

Marque como "ok" | "parcial" | "falhou":
- abertura_ancoragem_script
- profundidade_nao_fugir_assunto
- emocao_e_tensao
- prova_social_seeds_durante_perguntas
- objecao_real_vs_declarada
- negociacao_maximizar_receita

PASSO 5) PONTO DE PERDA + PORQUE COMPROU

PASSO 6) RESUMO EXECUTIVO

Nota geral (0–10), 3 maiores acertos, 3 maiores erros, 1 ajuste nº1.

FORMATO DE SAÍDA

Responda APENAS com um JSON válido (sem markdown, sem comentários).

{
  "framework_selecionado": "...",
  "confianca_framework": 0.0,
  "motivo_escolha_framework": ["..."],
  "identificacao": {
    "nome_lead": "...",
    "nome_closer": "...",
    "produto_ofertado": "...",
    "houve_venda": "sim|nao|nao_informado"
  },
  "dados_extraidos": {
    "nicho_profissao": "...",
    "modelo_de_venda": "...",
    "ticket_medio": "...",
    "faturamento_mensal_bruto": "...",
    "equipe": "...",
    "canais_aquisicao": ["..."],
    "estrutura_comercial": "...",
    "dor_principal_declarada": {"texto":"...", "evidencia":"..."},
    "dor_profunda": {"texto":"...", "evidencia":"..."},
    "objetivo_12_meses": "...",
    "urgencia_declarada": "...",
    "importancia_declarada": "...",
    "objecoes_levantadas": [{"objecao":"...", "evidencia":"..."}],
    "motivo_compra_ou_nao_compra": [{"motivo":"...", "evidencia":"..."}]
  },
  "nota_geral": 0,
  "justificativa_nota_geral": ["..."],
  "maiores_acertos": [{"acerto":"...", "evidencia":"...", "porque_importa":"...", "como_repetir":"..."}],
  "maiores_erros": [{"erro":"...", "evidencia":"...", "impacto":"...", "como_corrigir":["..."], "frase_pronta":{"antes":"...", "depois":"..."}}],
  "ponto_de_perda_da_venda": "...|null",
  "sinais_da_perda": ["..."],
  "se_vendeu": {"porque_comprou": [{"motivo":"...", "evidencia":"..."}], "gatilhos_que_mais_pesaram": ["..."]},
  "checklist_erros_recorrentes": {
    "abertura_ancoragem_script": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "profundidade_nao_fugir_assunto": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "emocao_e_tensao": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "prova_social_seeds_durante_perguntas": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "objecao_real_vs_declarada": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "negociacao_maximizar_receita": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."}
  },
  "analise_por_etapa": {
    "conexao": { ... },
    "abertura": { ... },
    "mapeamento_empresa": { ... },
    "mapeamento_problema": { ... },
    "consultoria": { ... },
    "problematizacao": { ... },
    "solucao_imaginada": { ... },
    "transicao": { ... },
    "pitch": { ... },
    "perguntas_compromisso": { ... },
    "fechamento": { ... },
    "objecoes_negociacao": { ... }
  },
  "plano_de_acao_direto": {
    "ajuste_numero_1": {"diagnostico":"...", "o_que_fazer_na_proxima_call":["..."], "script_30_segundos":"..."},
    "treino_recomendado": [{"habilidade":"...", "como_treinar":"...", "meta_objetiva":"..."}],
    "proxima_acao_com_lead": {"status":"fechado|follow_up|desqualificado|nao_informado", "passo":"...", "mensagem_sugerida_whats":"..."}
  }
}`;

// Função para chamar OpenAI diretamente
async function callOpenAI(systemPrompt: string, transcription: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  console.log("[reanalyze-call] Calling OpenAI with gpt-4o model...");
  console.log("[reanalyze-call] Transcription length:", transcription.length);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Analise a seguinte transcrição de call:\n\n${transcription}\n\n---\nFORMATO DE RESPOSTA OBRIGATÓRIO:\n- Retorne APENAS o JSON, sem texto adicional\n- NÃO use markdown code blocks\n- Comece com { e termine com }\n- TODAS as 12 etapas são OBRIGATÓRIAS em analise_por_etapa\n- Cada etapa deve ter estrutura COMPLETA\n- Máximo 2 evidências por etapa\n- Máximo 2 itens em como_corrigir\n- Textos curtos (1-2 frases)` 
        },
      ],
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[reanalyze-call] OpenAI API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402 || response.status === 401) {
      throw new Error("Invalid API key or payment required.");
    }
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  console.log("[reanalyze-call] OpenAI response length:", content.length);
  return content;
}

// Função robusta para parsear JSON da resposta
function parseJSONFromResponse(response: string): Record<string, unknown> {
  console.log("[reanalyze-call] Parsing response, length:", response.length);
  console.log("[reanalyze-call] Response preview (first 300 chars):", response.substring(0, 300));
  
  let jsonString = response;
  
  // Remove markdown code blocks usando GREEDY match
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*)```\s*$/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
    console.log("[reanalyze-call] Extracted from markdown, length:", jsonString.length);
  }
  
  // Encontra o JSON pelos delimitadores { e }
  const firstBrace = jsonString.indexOf('{');
  const lastBrace = jsonString.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    console.log("[reanalyze-call] Extracted by braces, length:", jsonString.length);
  }
  
  // Remove caracteres de controle que quebram JSON (exceto newlines e tabs)
  jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  try {
    const parsed = JSON.parse(jsonString);
    console.log("[reanalyze-call] JSON parsed successfully, keys:", Object.keys(parsed));
    return parsed;
  } catch (e) {
    console.error("[reanalyze-call] JSON parse failed:", e);
    console.error("[reanalyze-call] JSON (first 500):", jsonString.substring(0, 500));
    console.error("[reanalyze-call] JSON (last 500):", jsonString.substring(jsonString.length - 500));
    
    // Log posição do erro se disponível
    const errorMatch = String(e).match(/position (\d+)/);
    if (errorMatch) {
      const pos = parseInt(errorMatch[1]);
      console.error(`[reanalyze-call] Content around error position ${pos}:`, 
        jsonString.substring(Math.max(0, pos - 150), pos + 150));
    }
    
    throw new Error("Failed to parse AI response as JSON");
  }
}

// Estrutura padrão para etapas faltantes
const DEFAULT_STAGE = {
  aconteceu: "nao",
  nota: 0,
  funcao_cumprida: "Esta etapa não foi identificada na call",
  evidencias: [],
  ponto_forte: [],
  ponto_fraco: ["Etapa não executada ou não identificada"],
  erro_de_execucao: "Etapa ausente",
  impacto_no_lead: "Sem dados - etapa não aconteceu",
  como_corrigir: ["Revisar framework e garantir execução nas próximas calls"],
  frase_melhor: { antes: "", depois: "" },
  perguntas_de_aprofundamento: [],
  seeds_prova_social: { usadas: [], faltaram: [] },
  risco_principal_da_etapa: "Etapa não executada - risco de perda de profundidade"
};

// Lista das 12 etapas obrigatórias
const REQUIRED_STAGES = [
  'conexao', 'abertura', 'mapeamento_empresa', 'mapeamento_problema',
  'consultoria', 'problematizacao', 'solucao_imaginada', 'transicao',
  'pitch', 'perguntas_compromisso', 'fechamento', 'objecoes_negociacao'
];

// Garante que todas as 12 etapas existam
function ensureAllStages(data: Record<string, unknown>): void {
  if (!data.analise_por_etapa) {
    data.analise_por_etapa = {};
  }
  
  const etapas = data.analise_por_etapa as Record<string, unknown>;
  
  for (const stage of REQUIRED_STAGES) {
    const existing = etapas[stage];
    if (!existing || (typeof existing === 'object' && Object.keys(existing as object).length === 0)) {
      etapas[stage] = { ...DEFAULT_STAGE };
      console.log(`[reanalyze-call] Filled missing stage: ${stage}`);
    }
  }
  
  console.log("[reanalyze-call] All stages after fill:", Object.keys(etapas));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    console.log(`[reanalyze-call] Transcrição encontrada, length: ${call.transcription.length}`);

    // Chamar OpenAI DIRETAMENTE (sem intermediário)
    const aiResponse = await callOpenAI(MASTER_PROMPT, call.transcription);
    
    // Parsear o JSON
    const analysis = parseJSONFromResponse(aiResponse);
    
    // Garantir que todas as 12 etapas existam
    ensureAllStages(analysis);
    
    console.log('[reanalyze-call] Analysis keys:', Object.keys(analysis));

    // Construir updateData com estrutura correta
    const updateData: Record<string, unknown> = {
      // technical_analysis contém a análise completa para o frontend
      technical_analysis: {
        analise_por_etapa: analysis.analise_por_etapa,
        checklist_erros_recorrentes: analysis.checklist_erros_recorrentes,
        plano_de_acao_direto: analysis.plano_de_acao_direto,
        detailed_errors: analysis.maiores_erros,
        detailed_wins: analysis.maiores_acertos,
      },
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Extrair campos de resumo
    const notaGeral = analysis.nota_geral;
    if (notaGeral !== undefined) {
      updateData.score = typeof notaGeral === 'string' ? parseInt(notaGeral, 10) : notaGeral;
    }

    // Main errors e wins (arrays de strings para exibição rápida)
    const maioresErros = analysis.maiores_erros as Array<{erro?: string}> | undefined;
    const maioresAcertos = analysis.maiores_acertos as Array<{acerto?: string}> | undefined;
    
    if (maioresErros && Array.isArray(maioresErros)) {
      updateData.main_errors = maioresErros.map(e => e.erro).filter(Boolean);
    }
    if (maioresAcertos && Array.isArray(maioresAcertos)) {
      updateData.main_wins = maioresAcertos.map(a => a.acerto).filter(Boolean);
    }

    // Ponto de perda
    if (analysis.ponto_de_perda_da_venda) {
      updateData.loss_point = analysis.ponto_de_perda_da_venda;
    }

    // Dados extraídos
    const dados = analysis.dados_extraidos as Record<string, unknown> | undefined;
    if (dados) {
      if (dados.nicho_profissao && dados.nicho_profissao !== 'nao_informado') {
        updateData.niche = dados.nicho_profissao;
      }
      const dorPrincipal = dados.dor_principal_declarada as {texto?: string} | undefined;
      if (dorPrincipal?.texto && dorPrincipal.texto !== 'nao_informado') {
        updateData.main_pain = dorPrincipal.texto;
      }
      const dorProfunda = dados.dor_profunda as {texto?: string} | undefined;
      if (dorProfunda?.texto && dorProfunda.texto !== 'nao_informado') {
        updateData.main_difficulty = dorProfunda.texto;
      }
    }

    // AI Summary
    const justificativa = analysis.justificativa_nota_geral as string[] | undefined;
    if (justificativa && Array.isArray(justificativa)) {
      updateData.ai_summary = justificativa.join(' | ');
    }

    // Call conclusion
    const identificacao = analysis.identificacao as {houve_venda?: string} | undefined;
    if (identificacao?.houve_venda) {
      updateData.call_conclusion = identificacao.houve_venda === 'sim' ? 'vendeu' : 'nao_vendeu';
    }

    console.log('[reanalyze-call] updateData keys:', Object.keys(updateData));
    console.log('[reanalyze-call] Score:', updateData.score);
    console.log('[reanalyze-call] Main errors count:', (updateData.main_errors as string[] || []).length);
    console.log('[reanalyze-call] Main wins count:', (updateData.main_wins as string[] || []).length);

    // Salvar no banco
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

    const duration = Date.now() - startTime;
    console.log(`[reanalyze-call] Call ${callId} atualizada com sucesso em ${duration}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Call reanalisada com sucesso',
        callId,
        clientName: call.client_name,
        score: updateData.score,
        duration: `${duration}ms`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[reanalyze-call] Erro após ${duration}ms:`, error);
    
    return new Response(
      JSON.stringify({ error: 'Erro na análise', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
