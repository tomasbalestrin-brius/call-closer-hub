import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BETHEL_PROMPT = `Você é uma IA de Análise de Calls especializada em vendas high-ticket.

Sua tarefa é analisar a transcrição de uma call de vendas e extrair as seguintes informações:

1️⃣ EXTRAÇÃO DE DADOS DA CALL:
- nome_cliente: Nome do cliente/lead mencionado na call
- nicho: Nicho ou profissão do lead
- faturamento: Faturamento atual (número ou "não informado")
- tem_socio: Tem sócio? (sim/não/não_informado)
- maior_dificuldade: Maior dificuldade atual do lead
- dor_principal: Dor principal identificada
- produto: Produto/serviço sendo oferecido na call

2️⃣ RESUMO RÁPIDO DA CONVERSA (máximo 100 palavras):
- Contexto da call
- Problema central do lead
- Nível de consciência (inconsciente, consciente do problema, consciente da solução, decidido)
- Motivo da decisão ou não-decisão

3️⃣ CLASSIFICAÇÃO DO LEAD:
- pos_venda: Se fechou a venda, confirmar detalhes
- follow: Se não fechou, indicar melhor data para retorno

Responda APENAS com um JSON válido no seguinte formato:
{
  "nome_cliente": "string",
  "nicho": "string",
  "faturamento": "number ou null",
  "tem_socio": "sim" | "nao" | "nao_informado",
  "maior_dificuldade": "string",
  "dor_principal": "string",
  "produto": "string ou null",
  "resumo": "string (máx 100 palavras)",
  "nivel_consciencia": "inconsciente" | "consciente_problema" | "consciente_solucao" | "decidido",
  "motivo_decisao": "string",
  "classificacao": "pos_venda" | "follow",
  "proxima_data_contato": "YYYY-MM-DD ou null"
}`;

const MASTER_PROMPT = `Você é um Especialista Máximo em Vendas High Ticket, Neurociência da Decisão, Persuasão Ética e Análise de Calls.

Seu papel é analisar a transcrição de uma call de vendas usando o Framework de Closer – Julia Ottoni.

AVALIE CADA ETAPA DO FRAMEWORK (na ordem correta):
1. Conexão
2. Abertura
3. Mapeamento do Negócio
4. Mapeamento do Problema
5. Consultoria
6. Problematização
7. Solução Imaginada
8. Pitch
9. Contorno de Objeções
10. Fechamento

Para CADA etapa, avalie:
- aconteceu: sim/parcial/nao
- nota: 0-10
- funcao_cumprida: texto breve
- ponto_forte: o que foi bem
- ponto_fraco: o que travou
- sugestao: melhoria prática

AVALIAÇÃO GLOBAL:
- nota_geral: 0-10
- taxa_conversao_estimada: porcentagem
- tres_maiores_erros: array de strings
- tres_maiores_acertos: array de strings
- ponto_perda_venda: onde começou a perder (ou null se vendeu)
- ponto_fortalecimento: onde poderia ter fortalecido

CLASSIFICAÇÃO DO CLOSER:
- iniciante / intermediario / avancado / alta_performance / elite
- justificativa breve

Responda APENAS com um JSON válido no seguinte formato:
{
  "etapas": {
    "conexao": { "aconteceu": "sim|parcial|nao", "nota": 0-10, "funcao_cumprida": "...", "ponto_forte": "...", "ponto_fraco": "...", "sugestao": "..." },
    "abertura": { ... },
    "mapeamento_negocio": { ... },
    "mapeamento_problemas": { ... },
    "consultoria": { ... },
    "problematizacao": { ... },
    "solucao_imaginada": { ... },
    "pitch": { ... },
    "contorno_objecoes": { ... },
    "fechamento": { ... }
  },
  "nota_geral": 0-10,
  "taxa_conversao_estimada": "XX%",
  "tres_maiores_erros": ["erro1", "erro2", "erro3"],
  "tres_maiores_acertos": ["acerto1", "acerto2", "acerto3"],
  "ponto_perda_venda": "string ou null",
  "ponto_fortalecimento": "string",
  "classificacao_closer": "iniciante|intermediario|avancado|alta_performance|elite",
  "justificativa_classificacao": "string"
}`;

async function callOpenAI(systemPrompt: string, transcription: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analise a seguinte transcrição de call:\n\n${transcription}` },
      ],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402 || response.status === 401) {
      throw new Error("Invalid API key or payment required.");
    }
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseJSONFromResponse(response: string): unknown {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      throw new Error("Failed to parse AI response as JSON");
    }
  }
  throw new Error("No JSON found in AI response");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, fileName } = await req.json();
    
    if (!transcription) {
      return new Response(
        JSON.stringify({ error: "transcription is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing call from file: ${fileName}, transcription length: ${transcription.length}`);

    // Run both analyses in parallel for efficiency
    const [bethelResponse, masterResponse] = await Promise.all([
      callOpenAI(BETHEL_PROMPT, transcription),
      callOpenAI(MASTER_PROMPT, transcription),
    ]);

    console.log("Both AI analyses completed");

    // Parse the responses
    const bethelData = parseJSONFromResponse(bethelResponse) as {
      nome_cliente?: string;
      nicho?: string;
      faturamento?: number | null;
      tem_socio?: string;
      maior_dificuldade?: string;
      dor_principal?: string;
      produto?: string | null;
      resumo?: string;
      nivel_consciencia?: string;
      motivo_decisao?: string;
      classificacao?: string;
      proxima_data_contato?: string | null;
    };
    const masterData = parseJSONFromResponse(masterResponse) as {
      etapas?: Record<string, unknown>;
      nota_geral?: number;
      taxa_conversao_estimada?: string;
      tres_maiores_erros?: string[];
      tres_maiores_acertos?: string[];
      ponto_perda_venda?: string | null;
      ponto_fortalecimento?: string;
      classificacao_closer?: string;
      justificativa_classificacao?: string;
    };

    // Combine the analyses
    const analysis = {
      // Bethel extraction data
      client_name: bethelData.nome_cliente || "Cliente não identificado",
      niche: bethelData.nicho,
      revenue: bethelData.faturamento,
      has_partner: bethelData.tem_socio === "sim",
      main_difficulty: bethelData.maior_dificuldade,
      main_pain: bethelData.dor_principal,
      product: bethelData.produto,
      ai_summary: bethelData.resumo,
      consciousness_level: bethelData.nivel_consciencia,
      decision_reason: bethelData.motivo_decisao,
      lead_classification: bethelData.classificacao as "pos_venda" | "follow",
      next_contact_date: bethelData.proxima_data_contato,
      
      // Master technical analysis
      technical_analysis: masterData.etapas,
      call_score: masterData.nota_geral,
      conversion_rate_estimate: masterData.taxa_conversao_estimada,
      main_errors: masterData.tres_maiores_erros,
      main_wins: masterData.tres_maiores_acertos,
      loss_point: masterData.ponto_perda_venda,
      strengthening_point: masterData.ponto_fortalecimento,
      closer_classification: masterData.classificacao_closer,
      closer_justification: masterData.justificativa_classificacao,
    };

    console.log("Analysis complete, client:", analysis.client_name);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in analyze-call:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
