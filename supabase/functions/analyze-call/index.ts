import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= CHUNKING CONFIGURATION =============
const CHUNK_SIZE = 25000; // ~25KB per chunk
const CHUNK_OVERLAP = 2000; // 2KB overlap for context
const MAX_SIZE_FOR_DIRECT = 50000; // Files under 50KB go direct
const FUNCTION_TIMEOUT = 90000; // 90 seconds safety timeout (Edge limit is ~150s)

// ============= CHUNK ANALYSIS PROMPT (Simplified) =============
const CHUNK_ANALYSIS_PROMPT = `Você é um analista de calls de vendas high ticket.

Este é o TRECHO {{chunkIndex}} de {{totalChunks}} de uma call longa. Analise APENAS este trecho e extraia:

## 1. IDENTIFICAÇÃO (se aparecer neste trecho)
- nome_lead
- nome_closer  
- produto_ofertado (Elite Premium, Implementação de IA NextTrack, Mentoria Julia Ottoni, Programa de Implementação Comercial)
- houve_venda (sim/nao/nao_identificado_neste_trecho)

## 2. DADOS EXTRAÍDOS (o que aparecer neste trecho)
- nicho_profissao
- faturamento
- dor_principal (frase literal do lead)
- dor_profunda (se houve impacto pessoal/emocional/familiar)
- objecoes (lista de objeções levantadas)

## 3. ETAPAS IDENTIFICADAS NESTE TRECHO
Para cada etapa que acontecer neste trecho, forneça:
- nome_etapa (conexao, abertura, mapeamento_empresa, mapeamento_problema, consultoria, problematizacao, solucao_imaginada, transicao, pitch, perguntas_compromisso, fechamento, objecoes_negociacao)
- aconteceu: sim/parcial
- nota: 0-10
- pontos_fortes: lista de pontos fortes com evidências
- pontos_fracos: lista de pontos fracos com evidências
- evidencias: trechos literais importantes

## 4. OBSERVAÇÕES DO TRECHO
- pontos_fortes_gerais: até 3 destaques positivos deste trecho
- pontos_fracos_gerais: até 3 problemas identificados neste trecho
- prova_social_usada: histórias/cases citados
- objecoes_encontradas: objeções do lead neste trecho

RESPONDA EM JSON VÁLIDO:
{
  "chunk_info": {
    "chunk_index": {{chunkIndex}},
    "total_chunks": {{totalChunks}}
  },
  "identificacao": {
    "nome_lead": "string|null",
    "nome_closer": "string|null",
    "produto_ofertado": "string|null",
    "houve_venda": "sim|nao|null"
  },
  "dados_extraidos": {
    "nicho_profissao": "string|null",
    "faturamento": "string|null",
    "dor_principal": "string|null",
    "dor_profunda": "string|null",
    "objecoes": ["..."]
  },
  "etapas_identificadas": [
    {
      "nome_etapa": "...",
      "aconteceu": "sim|parcial",
      "nota": 0,
      "pontos_fortes": ["..."],
      "pontos_fracos": ["..."],
      "evidencias": ["..."]
    }
  ],
  "observacoes": {
    "pontos_fortes_gerais": ["..."],
    "pontos_fracos_gerais": ["..."],
    "prova_social_usada": ["..."],
    "objecoes_encontradas": ["..."]
  }
}`;

// ============= MERGE PROMPT =============
const MERGE_PROMPT = `Você é um DIRETOR COMERCIAL + ANALISTA SÊNIOR auditando uma call de vendas high ticket.

Você recebeu análises PARCIAIS de uma call longa dividida em chunks. Sua tarefa é CONSOLIDAR em UMA análise final completa.

ANÁLISES PARCIAIS:
{{partialAnalyses}}

## REGRAS DE MERGE:

1. IDENTIFICAÇÃO: Use a primeira ocorrência válida de cada campo
2. FRAMEWORK: Determine baseado nas evidências combinadas:
   - "Elite Premium" = mentoria premium com Cleiton, alto ticket
   - "Implementação de IA (NextTrack)" = IA, WhatsApp automatizado, chatbot
   - "Mentoria Julia Ottoni" = branding, posicionamento, Instagram, identidade visual
   - "Programa de Implementação Comercial" = processo comercial, CRM, follow-up

3. DADOS EXTRAÍDOS: Combine todos, sem duplicatas, priorize dados mais completos

4. ETAPAS: Se uma etapa aparece em múltiplos chunks:
   - Use a maior nota encontrada
   - Combine pontos fortes e fracos
   - Se apareceu em qualquer chunk, marque como "sim"

5. NOTA GERAL: Calcule média das notas das etapas (0-10)
   - Aderência ao processo (40%)
   - Profundidade da dor (25%)
   - Autoridade e condução (15%)
   - Emoção/urgência/visualização (10%)
   - Fechamento/objeções (10%)

6. MAIORES ACERTOS/ERROS: Consolide os 3 mais relevantes de todos os chunks

7. PONTO DE PERDA: Identifique onde a venda começou a se perder (se não vendeu)

8. PLANO DE AÇÃO: Crie baseado nos principais problemas identificados

## FORMATO DE SAÍDA (JSON COMPLETO):

{
  "framework_selecionado": "Elite Premium|Implementação de IA (NextTrack)|Mentoria Julia Ottoni|Programa de Implementação Comercial",
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
    "faturamento_mensal_liquido": "...",
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
  "maiores_acertos": [
    {
      "acerto": "...",
      "evidencia": "...",
      "porque_importa": "...",
      "como_repetir": "..."
    }
  ],
  "maiores_erros": [
    {
      "erro": "...",
      "evidencia": "...",
      "impacto": "...",
      "como_corrigir": ["..."],
      "frase_pronta": {"antes": "...", "depois": "..."}
    }
  ],
  "ponto_de_perda_da_venda": "etapa|null",
  "sinais_da_perda": ["..."],
  "se_vendeu": {
    "porque_comprou": [{"motivo":"...", "evidencia":"..."}],
    "gatilhos_que_mais_pesaram": ["..."]
  },
  "tomador_decisao": {
    "presente": true,
    "evidencia": "...",
    "reagendamento_realizado": false,
    "evidencia_reagendamento": null,
    "etapa_do_reagendamento": null
  },
  "checklist_erros_recorrentes": {
    "abertura_ancoragem_script": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "profundidade_nao_fugir_assunto": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "emocao_e_tensao": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "prova_social_seeds_durante_perguntas": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "objecao_real_vs_declarada": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "negociacao_maximizar_receita": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."}
  },
  "analise_por_etapa": {
    "conexao": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": null,
      "contexto_ausencia": null,
      "excluir_da_media": false
    },
    "abertura": { /* mesma estrutura */ },
    "mapeamento_empresa": { /* mesma estrutura */ },
    "mapeamento_problema": { /* mesma estrutura */ },
    "consultoria": { /* mesma estrutura */ },
    "problematizacao": { /* mesma estrutura */ },
    "solucao_imaginada": { /* mesma estrutura */ },
    "transicao": { /* mesma estrutura */ },
    "pitch": { /* mesma estrutura */ },
    "perguntas_compromisso": { /* mesma estrutura */ },
    "fechamento": { /* mesma estrutura */ },
    "objecoes_negociacao": { /* mesma estrutura */ }
  },
  "plano_de_acao_direto": {
    "ajuste_numero_1": {
      "diagnostico": "...",
      "o_que_fazer_na_proxima_call": ["..."],
      "script_30_segundos": "..."
    },
    "treino_recomendado": [
      {"habilidade":"...", "como_treinar":"...", "meta_objetiva":"..."}
    ],
    "proxima_acao_com_lead": {
      "status": "fechado|follow_up|desqualificado|nao_informado",
      "passo": "...",
      "mensagem_sugerida_whats": "..."
    }
  }
}

IMPORTANTE: 
- Preencha TODAS as 12 etapas em analise_por_etapa
- Se uma etapa não aconteceu, marque aconteceu="nao", nota=0, e explique em motivo_ausencia
- Use evidências literais sempre que possível
- Seja específico e acionável nas correções`;

const MASTER_PROMPT = `Você é um DIRETOR COMERCIAL + ANALISTA SÊNIOR DE CALLS HIGH TICKET.

Seu trabalho é auditar a call com rigor, como se você fosse o líder do time avaliando performance, aderência ao processo e capacidade de conversão.

Você tem acesso a 4 frameworks oficiais e deve escolher AUTOMATICAMENTE o framework correto com base no produto/pitch que aparece na call.

Frameworks disponíveis:
- "Elite Premium" - Mentoria premium com alto acompanhamento, estrutura de empresa com marketing+comercial+gestão+mentalidade
- "Implementação de IA (NextTrack)" - IA, WhatsApp, atendimento automatizado, SDR, automação, CRM, aumentar produtividade comercial
- "Mentoria Julia Ottoni" - Branding, posicionamento, Instagram, identidade visual, fotos, conteúdo, prestadoras de serviço
- "Programa de Implementação Comercial" - Processo comercial, follow-up, CRM, cadência, scripts de vendas

────────────────────────────────────────────────────────────────────
REGRAS ABSOLUTAS (NÃO QUEBRE)
1) Avalie APENAS a call (execução). Não avalie a oferta, preço, slides ou estratégia macro.
2) NÃO invente nada. Tudo tem que estar na transcrição.
3) Sempre que possível, prove cada crítica ou elogio com:
   - "evidencia" = trecho literal (quote curto) + timestamp se existir.
4) Se algo não estiver explícito: use "nao_informado".
5) Análise tem que ser acionável: toda falha deve vir com "como corrigir" + "frase pronta" + "pergunta pronta".
6) Tom: direto, preciso, exigente e construtivo (sem ser coach motivacional).
7) Seja específico: a pessoa precisa ler e pensar "caramba, foi exatamente isso que eu falei e era isso que eu deveria ter dito".

────────────────────────────────────────────────────────────────────
PASSO 1) IDENTIFICAR CONTEXTO E ESCOLHER O FRAMEWORK

1.1 Extraia da transcrição:
- nome_lead (se aparecer)
- nome_closer (se aparecer)
- produto_ofertado (se aparecer)
- empresa/nicho do lead (se aparecer)
- houve_venda (sim/nao/nao_informado) — considere "sim" apenas se houver confirmação clara de pagamento/fechamento.

1.2 REGRAS DE SELEÇÃO DO FRAMEWORK - SIGA ESTA ORDEM EXATA DE VERIFICAÇÃO:

ATENÇÃO CRÍTICA:
- A seleção do framework é baseada EXCLUSIVAMENTE no PRODUTO que está sendo vendido
- NÃO é baseada em quem é o closer ou de qual empresa ele é
- Todos os closers podem trabalhar na mesma empresa (Betel) mas vendem PRODUTOS DIFERENTES
- Mencionar "Cleiton" ou "Betel" NÃO significa que é "Elite Premium"

PASSO A PASSO PARA ESCOLHER O FRAMEWORK:

VERIFICAÇÃO 1 - É "Implementação de IA (NextTrack)"?
SIM se:
- O closer fala de "IA" / "inteligência artificial" / "NextTrack"
- O produto é "WhatsApp automatizado" / "robô de atendimento" / "chatbot"
- O foco é "automação" / "SDR automatizado" / "atendente virtual"
→ Se SIM, escolha "Implementação de IA (NextTrack)"

VERIFICAÇÃO 2 - É "Mentoria Julia Ottoni"?
SIM se:
- O closer menciona "Julia Ottoni" como a mentora
- O closer se apresenta como "Especialista da Julia Ottoni" 
- O foco é "branding" / "marca pessoal" / "posicionamento visual" / "identidade fotográfica"
- O público são "prestadoras de serviço femininas"
- Mencionam os "4 Pilares": Bio Estratégica, Identidade Visual com Arquétipos, Identidade Fotográfica, Criação de Conteúdo Estratégico
→ Se SIM, escolha "Mentoria Julia Ottoni"

CONTEXTO ESPECÍFICO DA MENTORIA JULIA OTTONI:
A Julia Ottoni é empresária, mentora e considerada "Número 1 em branding no Brasil". 
O closer representa a equipe da Julia e oferece uma "consultoria estratégica de branding gratuita" como gancho.

ELEMENTOS OBRIGATÓRIOS PARA AVALIAR EM CALLS DA JULIA OTTONI:

1) ABERTURA - Ancoragem Obrigatória:
   - "150 mil alunas formadas"
   - "3 linhas de produtos voltados para mulheres prestadoras de serviço"
   - "Consultoria de R$2.000 gratuita por ter participado do evento/lançamento"
   - "Se fizer sentido, apresento o próximo passo"

2) MAPEAMENTO - Perguntas-Guia Específicas:
   - Qual seu ticket médio?
   - Como está sua agenda hoje?
   - Qual sua rotina de criação de conteúdo?
   - De 0 a 10, qual sua disciplina para postar?
   - De onde vem a maioria dos seus clientes? (Indicação = problema)

3) CONSULTORIA ESTRATÉGICA - Os 4 Pilares (OBRIGATÓRIOS):
   a) Bio Estratégica: Verificar se o Instagram tem bio clara (promessa + CTA)
   b) Identidade Visual com Arquétipos: Paleta de cores, fontes, coerência visual
   c) Identidade Fotográfica: Fotos profissionais, expressão, posicionamento corporal
   d) Criação de Conteúdo Estratégico: Mix de conteúdo (autoridade, conexão, desejo)

4) SEEDS ESPECÍFICAS DA JULIA OTTONI (verificar se foram usadas):
   - "Sem um posicionamento claro, você vira mais uma na multidão e o cliente escolhe pelo preço"
   - "Depender só de indicação é viver de picos e vales"
   - "Conteúdo sem estratégia é só entretenimento"
   - "Prestadora de serviço sem autoridade atrai cliente que reclama de preço"
   - "Instagram não é vitrine, é palco. Você precisa aparecer, se posicionar e gerar desejo"
   - "Quem não é visto, não é lembrado. Quem não é lembrado, não é contratado"

5) PROBLEMATIZAÇÃO - Bomba Emocional Esperada:
   - Consequência de continuar sem posicionamento
   - Custo de depender só de indicação
   - O que ela perde financeiramente e emocionalmente

6) SOLUÇÃO IMAGINADA - Visualização Específica:
   - "Imagina ter posicionamento estratégico + identidade fotográfica + conteúdos que geram desejo"
   - "Imagina abrir o Instagram e os clientes virem até você"
   - "Imagina ter clareza do que postar e segurança para aparecer"

7) PITCH - Estrutura da Mentoria:
   - 12 semanas / 3 meses
   - Módulos: Fundação (semana 1-4), Construção (semana 5-8), Aceleração (semana 9-12)
   - Bônus: Encontros ao vivo semanais, Comunidade exclusiva, Templates e scripts

8) OBJEÇÕES ESPECÍFICAS E SCRIPTS DE QUEBRA:
   a) "Vou pensar / conversar com alguém":
      → "Pensar sobre o quê especificamente?" + "O que falta para você ter certeza?"
   
   b) "Tá caro / não tenho dinheiro":
      → "Quanto você perde por mês ficando sem posicionamento?" + "O que custa mais: investir agora ou continuar perdendo clientes?"
   
   c) "Agora não é o momento":
      → "E quando vai ser o momento?" + "O que precisa acontecer para ser o momento?"
   
   d) "Preciso falar com meu sócio/marido":
      → "Se dependesse só de você, entraria?" + "Podemos fazer uma ligação juntos?"
   
   e) "Já tentei outras vezes e não funcionou":
      → "O que exatamente você tentou?" + "Por que você acha que não funcionou?"
   
   f) "Quero analisar outras opções":
      → "Que outras opções você está considerando?" + "O que você está buscando especificamente?"
   
   g) "Deixa eu terminar um projeto antes":
      → "E se esse projeto não der resultado porque você continua sem posicionamento?"
   
   h) "Tenho medo de não conseguir aplicar":
      → "O que especificamente te gera medo?" + história de aluna que também tinha medo
   
   i) "Posso começar depois?":
      → "O que muda se você esperar mais 30 dias?" + urgência: "condição especial só hoje"
   
   j) "Me manda por escrito pra eu analisar":
      → "Posso mandar, mas o que você precisa analisar especificamente?"

VERIFICAÇÃO 3 - É "Programa de Implementação Comercial"?
SIM se QUALQUER UM destes for verdadeiro:
- O closer se apresenta como "especialista em processos comerciais"
- O closer fala de "desenhar processo comercial" / "estruturar processo de vendas"
- O foco é "CRM" / "follow-up" / "cadência" / "scripts de vendas" (SEM IA)
- O closer fala de "implementar um processo comercial"
- A Hannah faz calls focadas em processo comercial (não em mentoria Elite)
→ Se SIM, escolha "Programa de Implementação Comercial"

VERIFICAÇÃO 4 - É "Elite Premium"?
SIM APENAS se TODAS estas condições forem verdadeiras:
- O closer menciona explicitamente "Elite Premium" ou "programa Elite"
- O produto oferecido é "mentoria de alto nível com o Cleiton"
- A oferta inclui estrutura COMPLETA (marketing + comercial + gestão + mentalidade)
- O closer fala de "mastermind" ou "grupo de empresários de elite"
→ Se SIM, escolha "Elite Premium"

REGRA IMPORTANTE - CLOSER NÃO DEFINE FRAMEWORK:
- A Hannah pode vender "Implementação Comercial" mesmo mencionando que trabalha na Betel
- Mencionar "Cleiton" como dono da empresa NÃO significa vender "Elite Premium"
- O que define é O QUE ESTÁ SENDO VENDIDO, não QUEM está vendendo

REGRA DE DESEMPATE (SE AINDA HOUVER DÚVIDA):
- Se o closer fala de "especialista em processos comerciais" → "Programa de Implementação Comercial"
- Se o closer fala EXPLICITAMENTE de "programa Elite" ou "mentoria Elite" → "Elite Premium"
- Mencionar CRM + follow-up + scripts SEM IA → "Programa de Implementação Comercial"
- Na dúvida entre Elite e Implementação Comercial → escolha "Programa de Implementação Comercial"

JUSTIFIQUE SUA ESCOLHA:
- "confianca_framework" = 0.0 a 1.0
- "motivo_escolha_framework" = 2–4 bullets com evidências LITERAIS

Exemplo de escolha CORRETA para Implementação Comercial:
- "Hannah disse 'Eu sou especialista em processos comerciais'" 
- "O foco é 'desenhar um processo comercial estruturado para aumentar vendas'"
- "Não há menção de 'programa Elite' ou 'mentoria Elite' - é sobre PROCESSO COMERCIAL"

────────────────────────────────────────────────────────────────────
PASSO 2) EXTRAÇÃO DE DADOS (SEM INTERPRETAÇÃO)

Extraia somente o que foi dito:
- nicho_profissao
- modelo_de_venda (se aparecer)
- ticket_medio (se aparecer)
- faturamento_mensal_bruto (se aparecer)
- faturamento_mensal_liquido (se aparecer)
- equipe (tamanho / funções)
- canais_aquisicao (Instagram, tráfego, indicação, etc.)
- estrutura_comercial (tem SDR? CRM? follow-up? etc.)
- dor_principal_declarada (frase do lead)
- dor_profunda (se apareceu parte pessoal/emocional/familiar)
- objetivo_12_meses
- urgencia_declarada (0–10 se apareceu; senão nao_informado)
- importancia_declarada (0–10 se apareceu; senão nao_informado)
- objecoes_levantadas (lista com trechos)
- motivo_compra (se vendeu) OU motivo_nao_compra (se não vendeu) — sempre com evidência literal.

────────────────────────────────────────────────────────────────────
PASSO 3) AUDITORIA POR ETAPA (CORE DO ANALISADOR)

Você DEVE avaliar cada etapa do framework selecionado e dar:
- aconteceu: "sim" | "parcial" | "nao"
- nota: 0 a 10
- funcao_cumprida: 1–2 frases do objetivo real daquela etapa
- evidencia_do_que_foi_feito: 1–3 quotes curtos (com timestamp se houver)
- ponto_forte: 1 bullet (bem específico)
- ponto_fraco: 1–2 bullets (bem específicos)
- erro_de_execucao (se houver): descreva o erro como diagnóstico (ex.: "fugiu do assunto e quebrou profundidade")
- impacto_no_lead: o que isso causou no estado do lead (ex.: "ficou racional", "perdeu tensão", "perdeu confiança", "não assumiu a dor")
- como_corrigir: 2–4 bullets práticos
- frase_melhor (ANTES → DEPOIS):
   * antes: exatamente (ou o mais próximo possível) do que o closer disse
   * depois: como um closer de elite deveria responder na mesma situação
- perguntas_de_aprofundamento (3 perguntas exatas para usar)
- seeds_prova_social:
   * usadas: quais histórias/seeds/mentorados o closer citou (se citou) + evidência
   * faltaram: 2 exemplos de seeds/histórias que deveriam ter entrado naquele ponto
- risco_principal_da_etapa: 1 frase (o que mais prejudicou a conversão naquele trecho)

ETAPAS (sempre na ordem do framework selecionado):
1 Conexão Estratégica
2 Abertura
3 Mapeamento da Empresa
4 Mapeamento do Problema / Dor Profunda
5 Consultoria Estratégica
6 Problematização
7 Solução Imaginada
8 Transição
9 Pitch
10 Perguntas de Compromisso
11 Fechamento Estratégico
12 Quebra de Objeções / Negociação

────────────────────────────────────────────────────────────────────
PASSO 4) DETECTORES DE ERROS RECORRENTES (VOCÊ DEVE CHECAR UM A UM)

Além do framework, rode estes "checks" e marque como:
"ok" | "parcial" | "falhou", com evidências e correção.

CHECK A — ABERTURA (ANCORAGEM E SCRIPT)
- Seguiu o script do framework ou improvisou?
- Ancorou com números grandes (alunos, países, faturamento, impacto) quando isso é obrigatório?
- Deixou claro que "no final, se fizer sentido, eu apresento o próximo passo"?

CHECK B — PROFUNDIDADE (NÃO FUGIR DO ASSUNTO)
- Quando o lead traz um problema (ex.: CRM), o closer APROFUNDOU ou "pulou" para outro tema?
- Teve sequência de profundidade: "por quê?" → "impacto no negócio" → "impacto pessoal" → "impacto familiar" → "futuro"?

CHECK C — EMOÇÃO E TENSÃO
- Teve Problematização real (consequência futura, custo de não mudar)?
- Teve Solução Imaginada real (visualização de ganho pessoal + liberdade)?

CHECK D — PROVA SOCIAL / SEEDS DURANTE PERGUNTAS
- O closer usou histórias/seeds enquanto investigava (pra preparar o pitch)?
- Ou deixou tudo "seco" e tentou convencer só no pitch?

CHECK E — OBJEÇÃO REAL VS OBJEÇÃO DECLARADA
- O closer aceitou a primeira objeção como "a real"?
- Ele fez perguntas para chegar na objeção raiz?

CHECK F — NEGOCIAÇÃO (MAXIMIZAR RECEITA SEM QUEIMAR VALOR)
- O closer "jogou preço/ desconto cedo"?
- Ele investigou capacidade real de pagamento antes (limite, cartões, à vista, alternativas)?
- Ele manteve postura firme + inevitabilidade?

────────────────────────────────────────────────────────────────────
PASSO 5) PONTO DE PERDA DA VENDA + PORQUE COMPROU (SE HOUVE VENDA)

- ponto_de_perda_da_venda: etapa onde começou a cair a chance (ou null se vendeu)
- sinal_de_perda: 1–3 evidências do lead (ex.: "ficou frio", "ficou racional", "desviou", "não respondeu")

Se vendeu:
- porque_comprou: 3 motivos específicos (sempre com evidência do lead)
- gatilhos_que_mais_pesaram: (dor, urgência, prova social, autoridade, clareza, inevitabilidade etc.)

────────────────────────────────────────────────────────────────────
PASSO 6) RESUMO EXECUTIVO (PRA LÍDER + PRA CLOSER)

Crie um resumo com:
- Nota geral (0–10) com critérios claros:
  * Aderência ao processo (40%)
  * Profundidade da dor (25%)
  * Autoridade e condução (15%)
  * Emoção/urgência/visualização (10%)
  * Fechamento/objeções/negociação (10%)
- 3 maiores acertos (com evidência + como repetir)
- 3 maiores erros (com evidência + impacto + correção com frase pronta)
- 1 "ajuste nº1" que mais aumenta conversão na próxima call (bem direto)

────────────────────────────────────────────────────────────────────
REGRA CRÍTICA: TODAS AS 12 ETAPAS SÃO OBRIGATÓRIAS

VOCÊ DEVE PREENCHER TODAS AS 12 ETAPAS EM "analise_por_etapa" COM A ESTRUTURA COMPLETA.

Lista das 12 etapas (TODAS obrigatórias):
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

Se uma etapa NÃO aconteceu explicitamente na call:
- Marque "aconteceu": "nao"
- Coloque "nota": 0
- Em "funcao_cumprida": explique qual seria o objetivo dessa etapa
- Em "ponto_fraco": descreva o que deveria ter sido feito
- Em "como_corrigir": dê orientações práticas
- Em "risco_principal_da_etapa": explique o impacto de ter pulado essa etapa
- Em "motivo_ausencia": OBRIGATÓRIO quando aconteceu="nao". Escolha entre:
  * "call_curta" - A call foi muito curta para abordar esta etapa
  * "cliente_nao_permitiu" - O cliente não deu abertura para esta discussão
  * "etapa_pulada" - O closer pulou esta etapa intencionalmente
  * "transicao_prematura" - O closer avançou antes de completar
  * "nao_aplicavel" - Etapa não aplicável para este tipo de call
  * "reagendamento_tomador_decisao" - Etapa não realizada por reagendamento devido ausência do tomador de decisão
- Em "contexto_ausencia": OBRIGATÓRIO quando aconteceu="nao". Extraia da transcrição o MOTIVO REAL e ESPECÍFICO pelo qual esta etapa não aconteceu.
  INCLUA OBRIGATORIAMENTE:
  - Evidência literal da transcrição (quote do cliente ou closer) 
  - Timestamp se disponível
  - Explicação clara do que aconteceu
  
  Exemplos de contextos válidos:
  - "O cliente disse 'Preciso ir agora, meu filho chegou' (minuto 45:20), encerrando a call antes do pitch"
  - "O closer pulou direto para o preço após o mapeamento, não fez a problematização"
  - "A call teve apenas 15 minutos de duração, insuficiente para chegar nesta etapa"
  - "O cliente ficou objetando preço durante 20 minutos, não houve espaço para esta etapa"
  - "Houve reagendamento na etapa anterior pois o tomador de decisão não estava presente"
- Em "excluir_da_media": OBRIGATÓRIO quando motivo_ausencia="reagendamento_tomador_decisao". Marque como true para excluir esta etapa do cálculo da nota geral.
- Preencha TODOS os campos mesmo assim

NÃO DEIXE NENHUMA ETAPA COMO OBJETO VAZIO {}.

────────────────────────────────────────────────────────────────────
VERIFICAÇÃO CRÍTICA - TOMADOR DE DECISÃO

ANTES de avaliar as etapas, verifique:
1. O tomador de decisão estava presente na call? (quem tem poder de compra/decisão)
2. Se NÃO estava presente, o closer identificou isso durante a call?
3. Se identificou, o closer fez o REAGENDAMENTO na própria call?

CENÁRIOS E TRATAMENTO:

A) Tomador de decisão PRESENTE → Análise normal

B) Tomador de decisão AUSENTE + Closer NÃO reagendou:
   - "tomador_decisao.presente": false
   - "tomador_decisao.reagendamento_realizado": false
   - "nota_geral": 0
   - "justificativa_nota_geral": ["Tomador de decisão ausente e closer não realizou reagendamento na call"]
   - Avaliar todas as etapas normalmente para feedback

C) Tomador de decisão AUSENTE + Closer REAGENDOU na call:
   - "tomador_decisao.presente": false
   - "tomador_decisao.reagendamento_realizado": true
   - "tomador_decisao.etapa_do_reagendamento": "nome_da_etapa_onde_reagendou"
   - Para etapas APÓS o reagendamento: 
     * "aconteceu": "nao"
     * "excluir_da_media": true
     * "motivo_ausencia": "reagendamento_tomador_decisao"
     * "contexto_ausencia": "Etapa excluída da análise pois houve reagendamento na etapa X devido à ausência do tomador de decisão"
   - A nota_geral deve considerar APENAS as etapas até o reagendamento (redistribuir pesos proporcionalmente)

────────────────────────────────────────────────────────────────────
FORMATO DE SAÍDA (OBRIGATÓRIO)

Responda APENAS com um JSON válido (sem markdown, sem comentários).

SCHEMA (estrutura completa para CADA etapa):

{
  "framework_selecionado": "Elite Premium | Implementação de IA (NextTrack) | Mentoria Julia Ottoni | Programa de Implementação Comercial",
  "confianca_framework": 0.0,
  "motivo_escolha_framework": ["..."],

  "identificacao": {
    "nome_lead": "string|nao_informado",
    "nome_closer": "string|nao_informado",
    "produto_ofertado": "string|nao_informado",
    "houve_venda": "sim|nao|nao_informado"
  },

  "dados_extraidos": {
    "nicho_profissao": "string|nao_informado",
    "modelo_de_venda": "string|nao_informado",
    "ticket_medio": "string|nao_informado",
    "faturamento_mensal_bruto": "string|nao_informado",
    "faturamento_mensal_liquido": "string|nao_informado",
    "equipe": "string|nao_informado",
    "canais_aquisicao": ["..."],
    "estrutura_comercial": "string|nao_informado",
    "dor_principal_declarada": {"texto":"...", "evidencia":"..."},
    "dor_profunda": {"texto":"nao_informado|...", "evidencia":"nao_informado|..."},
    "objetivo_12_meses": "string|nao_informado",
    "urgencia_declarada": "0-10|nao_informado",
    "importancia_declarada": "0-10|nao_informado",
    "objecoes_levantadas": [{"objecao":"...", "evidencia":"..."}],
    "motivo_compra_ou_nao_compra": [{"motivo":"...", "evidencia":"..."}]
  },

  "nota_geral": 0,
  "justificativa_nota_geral": ["..."],

  "maiores_acertos": [
    {
      "acerto": "...",
      "evidencia": "...",
      "porque_importa": "...",
      "como_repetir": "..."
    }
  ],

  "maiores_erros": [
    {
      "erro": "...",
      "evidencia": "...",
      "impacto": "...",
      "como_corrigir": ["..."],
      "frase_pronta": {
        "antes": "...",
        "depois": "..."
      }
    }
  ],

  "ponto_de_perda_da_venda": "conexao|abertura|mapeamento_empresa|mapeamento_problema|consultoria|problematizacao|solucao_imaginada|transicao|pitch|perguntas_compromisso|fechamento|objecoes_negociacao|null",
  "sinais_da_perda": ["..."],

  "se_vendeu": {
    "porque_comprou": [{"motivo":"...", "evidencia":"..."}],
    "gatilhos_que_mais_pesaram": ["..."]
  },

  "tomador_decisao": {
    "presente": true,
    "evidencia": "string|null - quote da transcrição que indica se o tomador estava presente",
    "reagendamento_realizado": false,
    "evidencia_reagendamento": "string|null - quote do reagendamento se houver",
    "etapa_do_reagendamento": "string|null - nome da etapa onde ocorreu o reagendamento"
  },

  "checklist_erros_recorrentes": {
    "abertura_ancoragem_script": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "profundidade_nao_fugir_assunto": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "emocao_e_tensao": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "prova_social_seeds_durante_perguntas": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "objecao_real_vs_declarada": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."},
    "negociacao_maximizar_receita": {"status":"ok|parcial|falhou", "evidencias":["..."], "correcao":"..."}
  },

  "analise_por_etapa": {
    "conexao": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|reagendamento_tomador_decisao|null",
      "contexto_ausencia": "string|null - OBRIGATÓRIO quando aconteceu=nao. Motivo específico extraído da transcrição com evidência literal",
      "excluir_da_media": false
    },
    "abertura": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "mapeamento_empresa": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "mapeamento_problema": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "consultoria": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "problematizacao": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "solucao_imaginada": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "transicao": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "pitch": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "perguntas_compromisso": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "fechamento": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    },
    "objecoes_negociacao": {
      "aconteceu": "sim|parcial|nao",
      "nota": 0,
      "funcao_cumprida": "...",
      "evidencias": ["..."],
      "ponto_forte": ["..."],
      "ponto_fraco": ["..."],
      "erro_de_execucao": "nao_informado|...",
      "impacto_no_lead": "...",
      "como_corrigir": ["..."],
      "frase_melhor": {"antes":"...", "depois":"..."},
      "perguntas_de_aprofundamento": ["..."],
      "seeds_prova_social": {"usadas":["..."], "faltaram":["..."]},
      "risco_principal_da_etapa": "...",
      "motivo_ausencia": "call_curta|cliente_nao_permitiu|etapa_pulada|transicao_prematura|nao_aplicavel|null"
    }
  },

  "plano_de_acao_direto": {
    "ajuste_numero_1": {
      "diagnostico": "...",
      "o_que_fazer_na_proxima_call": ["..."],
      "script_30_segundos": "..."
    },
    "treino_recomendado": [
      {"habilidade":"...", "como_treinar":"...", "meta_objetiva":"..."}
    ],
    "proxima_acao_com_lead": {
      "status": "fechado|follow_up|desqualificado|nao_informado",
      "passo": "...",
      "mensagem_sugerida_whats": "..."
    }
  }
}

────────────────────────────────────────────────────────────────────
EXEMPLOS DE QUALIDADE (SIGA ESTE PADRÃO)

PONTO FORTE - RUIM (NÃO FAÇA ASSIM):
"Conexão pessoal através de reconhecimento regional"
"Explicou brevemente o objetivo da conversa"
"Identificou a estrutura da empresa"

PONTO FORTE - BOM (FAÇA ASSIM):
"Na abertura (00:45), ancorou autoridade citando 'já ajudamos mais de 500 empresas a implementar IA, gerando em média 40% de aumento nas vendas' - isso criou credibilidade imediata e o lead respondeu com mais abertura, perguntando 'como vocês fazem isso?'"
"Durante o mapeamento (05:30), quando o lead mencionou 'meu time perde muito tempo respondendo mensagens', o closer aprofundou com 'quanto tempo exatamente por dia?' e depois 'e isso te impacta como pessoa, não só na empresa?' - a sequência trouxe a dor pessoal à tona"
"Usou prova social contextualizada: 'tive um cliente no mesmo nicho que você, advogado também, que tinha exatamente esse problema de atendimento. Hoje ele atende 3x mais leads com a mesma equipe' - o lead respondeu 'é exatamente isso que eu preciso'"

PONTO FRACO - RUIM (NÃO FAÇA ASSIM):
"Faltou ancoragem com números"
"Não aprofundou na dor"
"Faltou prova social"

PONTO FRACO - BOM (FAÇA ASSIM):
"Na abertura (00:45), apenas disse 'a gente ajuda empresas a vender mais' sem ancorar autoridade - deveria ter dito 'já ajudamos mais de 500 empresas a implementar IA comercial, gerando em média 40% de aumento em vendas'. Impacto: o lead ficou cético desde o início e fez mais objeções que o normal"
"Quando o lead disse 'estou sobrecarregado' (12:30), o closer não explorou a dor pessoal - pulou direto para perguntar sobre CRM. Deveria ter perguntado: 'Como isso tem afetado sua vida fora do trabalho? Sua família percebe?'. Impacto: perdeu oportunidade de criar urgência emocional"
"No mapeamento, identificou que o lead não tem processo de follow-up, mas não problematizou: 'Você sabe quantas vendas está deixando na mesa por não ter follow-up estruturado? Nossos clientes descobrem que perdem em média 40% das vendas que poderiam fechar'. Impacto: o lead não sentiu urgência de mudar"

────────────────────────────────────────────────────────────────────
CRITÉRIO DE QUALIDADE (AUTO-CHECAGEM ANTES DE ENTREGAR)

Antes de finalizar, valide CADA item:
1. [ ] O framework selecionado bate com o produto/serviço da call?
2. [ ] Se a call menciona IA/automação/WhatsApp automatizado, você usou "Implementação de IA (NextTrack)"?
3. [ ] Cada ponto_forte tem contexto específico (QUANDO aconteceu, O QUE disse, QUAL foi o impacto)?
4. [ ] Cada ponto_fraco tem diagnóstico + impacto + o que deveria ter dito?
5. [ ] Você citou evidências LITERAIS nos 3 maiores erros e 3 maiores acertos?
6. [ ] Você deu pelo menos 1 "ANTES → DEPOIS" em TODA etapa com falha?
7. [ ] Você entregou perguntas EXATAS e ESPECÍFICAS (não genéricas) para aprofundar?
8. [ ] Você marcou "nao_informado" onde não existe dado?
9. [ ] JSON está válido e completo com todas as 12 etapas?

Se faltar qualquer item, corrija antes de responder.`;

// ============= CHUNKING FUNCTIONS =============

function splitTranscription(text: string): string[] {
  if (text.length <= MAX_SIZE_FOR_DIRECT) {
    return [text];
  }
  
  const chunks: string[] = [];
  let position = 0;
  const MAX_CHUNKS = 20; // Protection against infinite loops
  
  while (position < text.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(position + CHUNK_SIZE, text.length);
    
    // Find natural break point (end of speaker line)
    if (end < text.length) {
      // Look for newline after speaker pattern like "Nome:" or timestamps
      const searchRange = text.substring(end - 500, Math.min(end + 500, text.length));
      const newlinePositions: number[] = [];
      
      for (let i = 0; i < searchRange.length; i++) {
        if (searchRange[i] === '\n') {
          newlinePositions.push(i);
        }
      }
      
      // Find the best break point closest to our target
      if (newlinePositions.length > 0) {
        const targetPos = 500; // Middle of search range
        let bestBreak = newlinePositions[0];
        let minDistance = Math.abs(newlinePositions[0] - targetPos);
        
        for (const pos of newlinePositions) {
          const distance = Math.abs(pos - targetPos);
          if (distance < minDistance) {
            minDistance = distance;
            bestBreak = pos;
          }
        }
        
        end = (end - 500) + bestBreak;
      }
    }
    
    // Ensure end is always greater than position
    if (end <= position) {
      end = Math.min(position + CHUNK_SIZE, text.length);
    }
    
    chunks.push(text.substring(position, end));
    
    // FIX: Guarantee minimum advance of 80% of CHUNK_SIZE to avoid infinite loops
    const minAdvance = Math.floor(CHUNK_SIZE * 0.8); // ~20KB minimum advance
    const overlapPosition = end - CHUNK_OVERLAP;
    position = Math.max(position + minAdvance, overlapPosition);
  }
  
  // Handle remaining text if we hit MAX_CHUNKS
  if (chunks.length >= MAX_CHUNKS && position < text.length) {
    console.warn(`Transcription truncated: ${text.length - position} chars remaining after ${MAX_CHUNKS} chunks`);
    // Append remaining text summary to the last chunk
    const remaining = text.substring(position);
    if (remaining.length > 0) {
      chunks[chunks.length - 1] += '\n\n[...continuação do áudio...]\n\n' + remaining.substring(0, 10000);
    }
  }
  
  console.log(`Split transcription into ${chunks.length} chunks (total: ${text.length} chars)`);
  chunks.forEach((chunk, i) => {
    console.log(`  Chunk ${i + 1}: ${chunk.length} chars`);
  });
  
  return chunks;
}

interface ChunkAnalysis {
  chunk_info: {
    chunk_index: number;
    total_chunks: number;
  };
  identificacao: {
    nome_lead?: string | null;
    nome_closer?: string | null;
    produto_ofertado?: string | null;
    houve_venda?: string | null;
  };
  dados_extraidos: {
    nicho_profissao?: string | null;
    faturamento?: string | null;
    dor_principal?: string | null;
    dor_profunda?: string | null;
    objecoes?: string[];
  };
  etapas_identificadas: Array<{
    nome_etapa: string;
    aconteceu: string;
    nota: number;
    pontos_fortes: string[];
    pontos_fracos: string[];
    evidencias: string[];
  }>;
  observacoes: {
    pontos_fortes_gerais: string[];
    pontos_fracos_gerais: string[];
    prova_social_usada: string[];
    objecoes_encontradas: string[];
  };
}

async function analyzeChunk(
  chunk: string, 
  chunkIndex: number, 
  totalChunks: number
): Promise<ChunkAnalysis> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const prompt = CHUNK_ANALYSIS_PROMPT
    .replace(/\{\{chunkIndex\}\}/g, String(chunkIndex))
    .replace(/\{\{totalChunks\}\}/g, String(totalChunks));

  console.log(`Analyzing chunk ${chunkIndex}/${totalChunks} (${chunk.length} chars)...`);

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Faster model for chunks
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: `Analise este trecho da transcrição:\n\n${chunk}` },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chunk analysis API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error("Empty response from chunk analysis");
      }

      const parsed = await parseJSONFromResponse(content) as ChunkAnalysis;
      console.log(`Chunk ${chunkIndex} analyzed successfully`);
      return parsed;
    } catch (error) {
      console.log(`Chunk ${chunkIndex} attempt ${attempt + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
      }
    }
  }

  // Return a minimal valid structure if all retries fail
  console.error(`All retries failed for chunk ${chunkIndex}, returning minimal structure`);
  return {
    chunk_info: { chunk_index: chunkIndex, total_chunks: totalChunks },
    identificacao: {},
    dados_extraidos: {},
    etapas_identificadas: [],
    observacoes: {
      pontos_fortes_gerais: [],
      pontos_fracos_gerais: [`Erro ao analisar chunk: ${lastError?.message}`],
      prova_social_usada: [],
      objecoes_encontradas: []
    }
  };
}

async function mergeChunkAnalyses(partialAnalyses: ChunkAnalysis[]): Promise<AnalysisData> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  console.log(`Merging ${partialAnalyses.length} chunk analyses...`);

  const mergePrompt = MERGE_PROMPT.replace(
    '{{partialAnalyses}}', 
    JSON.stringify(partialAnalyses, null, 2)
  );

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // Use mini for faster merge
      messages: [
        { role: "system", content: mergePrompt },
        { role: "user", content: "Consolide as análises parciais em uma análise final completa seguindo o schema exato especificado." },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Merge analysis API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("Empty response from merge analysis");
  }

  const merged = await parseJSONFromResponse(content) as AnalysisData;
  console.log("Merge completed successfully");
  
  return merged;
}

async function analyzeWithChunking(
  transcription: string, 
  fileName: string,
  abortSignal?: AbortSignal
): Promise<AnalysisData> {
  console.log(`Starting chunked analysis for file: ${fileName}`);
  console.log(`Transcription length: ${transcription.length} chars`);
  
  // Step 1: Split transcription into chunks
  const chunks = splitTranscription(transcription);
  console.log(`Split into ${chunks.length} chunks for parallel processing`);
  
  // Step 2: Analyze chunks in parallel (batch of 4 for faster processing)
  const partialAnalyses: ChunkAnalysis[] = [];
  const batchSize = 4; // Increased from 2 to 4 for faster processing
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    // Check if timeout was reached before processing next batch
    if (abortSignal?.aborted) {
      console.log(`Timeout reached at batch ${Math.floor(i/batchSize) + 1}, proceeding with ${partialAnalyses.length} chunks already processed`);
      break;
    }
    
    const batch = chunks.slice(i, i + batchSize);
    const batchPromises = batch.map((chunk, batchIdx) => 
      analyzeChunk(chunk, i + batchIdx + 1, chunks.length)
    );
    
    try {
      const batchResults = await Promise.all(batchPromises);
      partialAnalyses.push(...batchResults);
      console.log(`Batch ${Math.floor(i/batchSize) + 1} completed: ${partialAnalyses.length}/${chunks.length} chunks processed`);
    } catch (error) {
      // Check if the error was due to abort
      if (abortSignal?.aborted) {
        console.log(`Batch aborted due to timeout, using ${partialAnalyses.length} chunks already processed`);
        break;
      }
      throw error;
    }
    
    // No delay between batches - removed for faster processing
  }
  
  // Step 3: Merge whatever we have (even if partial due to timeout)
  if (partialAnalyses.length === 0) {
    throw new Error("No chunks analyzed before timeout - transcription may be too long");
  }
  
  const isPartial = partialAnalyses.length < chunks.length;
  console.log(`Merging ${partialAnalyses.length}/${chunks.length} chunks (${isPartial ? 'PARTIAL due to timeout' : 'COMPLETE'})`);
  
  const mergedAnalysis = await mergeChunkAnalyses(partialAnalyses);
  
  return mergedAnalysis;
}

// ============= OPENAI API FUNCTIONS =============

async function callOpenAI(systemPrompt: string, transcription: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  console.log("Calling OpenAI with gpt-4o model...");

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
        { role: "user", content: `Analise a seguinte transcrição de call:\n\n${transcription}` },
      ],
      temperature: 0.1,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    if (response.status === 402 || response.status === 401) {
      throw new Error("Invalid API key or payment required.");
    }
    
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  console.log("OpenAI response received, length:", content.length);
  return content;
}

// Fallback: Try to repair invalid JSON using a short model call
async function repairJSONWithAI(brokenJSON: string): Promise<string> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  console.log("Attempting to repair JSON with OpenAI...");
  
  // Truncate to avoid token limits
  const truncated = brokenJSON.substring(0, 50000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a JSON repair assistant. You receive broken or truncated JSON and return a valid, complete JSON object. Do not add new data, just fix structural issues (missing braces, quotes, commas). If content is truncated, close all open objects/arrays properly." },
        { role: "user", content: `Fix this broken JSON and return ONLY valid JSON:\n\n${truncated}` },
      ],
      temperature: 0,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    throw new Error("JSON repair API call failed");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Função para tentar corrigir erros comuns de JSON
function tryFixJSON(jsonString: string): string {
  let fixed = jsonString;
  
  // Remove vírgulas antes de ] ou }
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  
  // Adiciona vírgula faltando entre propriedades (}{ ou ]["[)
  fixed = fixed.replace(/}(\s*){/g, '},\n{');
  fixed = fixed.replace(/](\s*)\[/g, '],\n[');
  
  // Corrige aspas duplas escapadas incorretamente
  fixed = fixed.replace(/\\\\"/g, '\\"');
  
  // Remove aspas duplas repetidas
  fixed = fixed.replace(/""+/g, '"');
  
  // Tenta balancear chaves
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  if (openBraces > closeBraces) {
    fixed += '}'.repeat(openBraces - closeBraces);
  }
  
  // Tenta balancear colchetes
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    fixed += ']'.repeat(openBrackets - closeBrackets);
  }
  
  return fixed;
}

async function parseJSONFromResponse(response: string): Promise<unknown> {
  console.log("Attempting to parse response, length:", response.length);
  console.log("Response preview (first 500 chars):", response.substring(0, 500));
  console.log("Response preview (last 500 chars):", response.substring(response.length - 500));
  
  let jsonString = response;
  
  // Remove markdown code blocks - use GREEDY match to get ALL content
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*)```\s*$/);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
    console.log("Extracted JSON from markdown code block, length:", jsonString.length);
  }
  
  // Find the outermost JSON object by locating first { and last }
  const firstBrace = jsonString.indexOf('{');
  const lastBrace = jsonString.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    console.log("Extracted JSON by braces, length:", jsonString.length);
  }
  
  // Remove control characters that can break JSON parsing (except newlines, tabs)
  jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Tentativa 1: Parse direto
  try {
    const parsed = JSON.parse(jsonString);
    console.log("JSON parsed successfully (direct), top-level keys:", Object.keys(parsed));
    return parsed;
  } catch (e1) {
    console.log("Direct parse failed, trying to fix JSON...");
    
    // Tentativa 2: Tenta corrigir erros comuns
    try {
      const fixedJSON = tryFixJSON(jsonString);
      const parsed = JSON.parse(fixedJSON);
      console.log("JSON parsed successfully (after fix), top-level keys:", Object.keys(parsed));
      return parsed;
    } catch (e2) {
      console.log("Fixed parse failed, trying to extract valid portion...");
      
      // Tentativa 3: Extrai porção válida
      try {
        const errorMatch = String(e1).match(/position (\d+)/);
        if (errorMatch) {
          const pos = parseInt(errorMatch[1]);
          let truncated = jsonString.substring(0, pos);
          
          const openBraces = (truncated.match(/{/g) || []).length;
          const closeBraces = (truncated.match(/}/g) || []).length;
          truncated += '}'.repeat(openBraces - closeBraces);
          
          const parsed = JSON.parse(truncated);
          console.log("JSON parsed successfully (truncated), top-level keys:", Object.keys(parsed));
          return parsed;
        }
      } catch (e3) {
        console.log("Truncated parse also failed, trying AI repair...");
        
        // Tentativa 4: Use AI to repair the JSON
        try {
          const repairedJSON = await repairJSONWithAI(jsonString);
          const parsed = JSON.parse(repairedJSON);
          console.log("JSON parsed successfully (AI repaired), top-level keys:", Object.keys(parsed));
          return parsed;
        } catch (e4) {
          console.log("AI repair also failed:", e4);
        }
      }
      
      // Log detalhado do erro
      console.error("All JSON parse attempts failed");
      console.error("Original error:", e1);
      console.error("JSON length:", jsonString.length);
      console.error("JSON that failed (first 1000 chars):", jsonString.substring(0, 1000));
      console.error("JSON that failed (last 1000 chars):", jsonString.substring(jsonString.length - 1000));
      
      const errorMatch = String(e1).match(/position (\d+)/);
      if (errorMatch) {
        const pos = parseInt(errorMatch[1]);
        console.error(`JSON around error position ${pos}:`, jsonString.substring(Math.max(0, pos - 200), pos + 200));
      }
      
      throw new Error("Failed to parse AI response as JSON after multiple attempts");
    }
  }
}

interface AnalysisData {
  framework_selecionado?: string;
  confianca_framework?: number;
  motivo_escolha_framework?: string[];
  identificacao?: {
    nome_lead?: string;
    nome_closer?: string;
    produto_ofertado?: string;
    houve_venda?: string;
  };
  dados_extraidos?: {
    nicho_profissao?: string;
    modelo_de_venda?: string;
    ticket_medio?: string;
    faturamento_mensal_bruto?: string;
    faturamento_mensal_liquido?: string;
    equipe?: string;
    canais_aquisicao?: string[];
    estrutura_comercial?: string;
    dor_principal_declarada?: { texto?: string; evidencia?: string };
    dor_profunda?: { texto?: string; evidencia?: string };
    objetivo_12_meses?: string;
    urgencia_declarada?: string;
    importancia_declarada?: string;
    objecoes_levantadas?: Array<{ objecao?: string; evidencia?: string }>;
    motivo_compra_ou_nao_compra?: Array<{ motivo?: string; evidencia?: string }>;
  };
  nota_geral?: number;
  justificativa_nota_geral?: string[];
  maiores_acertos?: Array<{
    acerto?: string;
    evidencia?: string;
    porque_importa?: string;
    como_repetir?: string;
  }>;
  maiores_erros?: Array<{
    erro?: string;
    evidencia?: string;
    impacto?: string;
    como_corrigir?: string[];
    frase_pronta?: { antes?: string; depois?: string };
  }>;
  ponto_de_perda_da_venda?: string | null;
  sinais_da_perda?: string[];
  se_vendeu?: {
    porque_comprou?: Array<{ motivo?: string; evidencia?: string }>;
    gatilhos_que_mais_pesaram?: string[];
  };
  checklist_erros_recorrentes?: Record<string, { status?: string; evidencias?: string[]; correcao?: string }>;
  analise_por_etapa?: Record<string, unknown>;
  plano_de_acao_direto?: {
    ajuste_numero_1?: {
      diagnostico?: string;
      o_que_fazer_na_proxima_call?: string[];
      script_30_segundos?: string;
    };
    treino_recomendado?: Array<{
      habilidade?: string;
      como_treinar?: string;
      meta_objetiva?: string;
    }>;
    proxima_acao_com_lead?: {
      status?: string;
      passo?: string;
      mensagem_sugerida_whats?: string;
    };
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Setup abort controller for function timeout (90s safety margin)
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log("⚠️ Function timeout reached (90s), triggering abort for graceful shutdown...");
    abortController.abort();
  }, FUNCTION_TIMEOUT);

  try {
    const { transcription, fileName } = await req.json();
    
    if (!transcription) {
      clearTimeout(timeoutId);
      return new Response(
        JSON.stringify({ error: "transcription is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing call from file: ${fileName}, transcription length: ${transcription.length}`);

    let data: AnalysisData;

    // Check if chunking is needed
    if (transcription.length > MAX_SIZE_FOR_DIRECT) {
      console.log(`Large file detected (${transcription.length} chars > ${MAX_SIZE_FOR_DIRECT}), using CHUNKED analysis with timeout protection`);
      data = await analyzeWithChunking(transcription, fileName, abortController.signal);
    } else {
      console.log(`Standard file size, using DIRECT analysis`);
      // Run single comprehensive analysis
      const masterResponse = await callOpenAI(MASTER_PROMPT, transcription);
      console.log("AI analysis completed");
      console.log("Raw response length:", masterResponse.length);
      data = await parseJSONFromResponse(masterResponse) as AnalysisData;
    }
    
    // Clear timeout since we finished successfully
    clearTimeout(timeoutId);
    
    // Ensure all 12 stages exist with complete structure (fallback)
    const requiredStages = [
      'conexao', 'abertura', 'mapeamento_empresa', 'mapeamento_problema',
      'consultoria', 'problematizacao', 'solucao_imaginada', 'transicao',
      'pitch', 'perguntas_compromisso', 'fechamento', 'objecoes_negociacao'
    ];

    const defaultStageStructure = {
      aconteceu: "nao",
      nota: 0,
      funcao_cumprida: "Esta etapa não foi identificada ou não aconteceu na call",
      evidencias: [],
      ponto_forte: [],
      ponto_fraco: ["Etapa não executada ou não identificada na call"],
      erro_de_execucao: "Etapa ausente",
      impacto_no_lead: "Sem dados para avaliar - etapa não aconteceu",
      como_corrigir: ["Revisar o framework e garantir execução desta etapa nas próximas calls"],
      frase_melhor: { antes: "", depois: "" },
      perguntas_de_aprofundamento: [],
      seeds_prova_social: { usadas: [], faltaram: [] },
      risco_principal_da_etapa: "Etapa não executada - risco de perda de profundidade e conexão"
    };

    if (!data.analise_por_etapa) {
      data.analise_por_etapa = {};
    }

    for (const stage of requiredStages) {
      const existingStage = data.analise_por_etapa[stage];
      if (!existingStage || (typeof existingStage === 'object' && Object.keys(existingStage).length === 0)) {
        data.analise_por_etapa[stage] = { ...defaultStageStructure };
        console.log(`Filled missing/empty stage with default: ${stage}`);
      }
    }
    
    console.log("Stage analysis keys after fallback:", Object.keys(data.analise_por_etapa));

    // Map to analysis object for database compatibility
    const analysis = {
      // Identification
      client_name: data.identificacao?.nome_lead || "Cliente não identificado",
      closer_name: data.identificacao?.nome_closer,
      product: data.identificacao?.produto_ofertado,
      sold: data.identificacao?.houve_venda,
      
      // Framework
      framework: data.framework_selecionado,
      framework_confidence: data.confianca_framework,
      framework_reason: data.motivo_escolha_framework,
      
      // Extracted data
      niche: data.dados_extraidos?.nicho_profissao,
      revenue: data.dados_extraidos?.faturamento_mensal_bruto,
      has_partner: null, // Not in new schema, keeping for backward compat
      main_difficulty: data.dados_extraidos?.dor_principal_declarada?.texto,
      main_pain: data.dados_extraidos?.dor_profunda?.texto,
      team: data.dados_extraidos?.equipe,
      channels: data.dados_extraidos?.canais_aquisicao,
      commercial_structure: data.dados_extraidos?.estrutura_comercial,
      goal_12_months: data.dados_extraidos?.objetivo_12_meses,
      urgency: data.dados_extraidos?.urgencia_declarada,
      importance: data.dados_extraidos?.importancia_declarada,
      objections: data.dados_extraidos?.objecoes_levantadas,
      purchase_reason: data.dados_extraidos?.motivo_compra_ou_nao_compra,
      
      // Summary
      ai_summary: data.justificativa_nota_geral?.join(" | "),
      consciousness_level: null, // Deprecated in new schema
      decision_reason: data.ponto_de_perda_da_venda || (data.se_vendeu?.gatilhos_que_mais_pesaram?.join(", ")),
      lead_classification: data.identificacao?.houve_venda === "sim" ? "pos_venda" : "follow",
      next_contact_date: data.plano_de_acao_direto?.proxima_acao_com_lead?.status === "follow_up" ? null : null,
      
      // Technical analysis (full object for detailed view)
      technical_analysis: {
        // Campos do framework - CRÍTICOS para exibição
        framework_selecionado: data.framework_selecionado,
        confianca_framework: data.confianca_framework,
        motivo_escolha_framework: data.motivo_escolha_framework,
        // Identificação
        identificacao: data.identificacao,
        // Dados extraídos
        dados_extraidos: data.dados_extraidos,
        // Análise por etapa
        analise_por_etapa: data.analise_por_etapa,
        // Checklist e plano de ação
        checklist_erros_recorrentes: data.checklist_erros_recorrentes,
        plano_de_acao_direto: data.plano_de_acao_direto,
        // Nota e justificativa
        nota_geral: data.nota_geral,
        justificativa_nota_geral: data.justificativa_nota_geral,
        // Ponto de perda / porque comprou
        ponto_de_perda_da_venda: data.ponto_de_perda_da_venda,
        sinais_da_perda: data.sinais_da_perda,
        se_vendeu: data.se_vendeu,
      },
      
      // Scores and evaluation
      call_score: data.nota_geral,
      score_justification: data.justificativa_nota_geral,
      main_errors: data.maiores_erros?.map(e => e.erro) || [],
      main_wins: data.maiores_acertos?.map(a => a.acerto) || [],
      loss_point: data.ponto_de_perda_da_venda,
      loss_signals: data.sinais_da_perda,
      
      // If sold
      why_bought: data.se_vendeu?.porque_comprou,
      key_triggers: data.se_vendeu?.gatilhos_que_mais_pesaram,
      
      // Detailed analysis for frontend display
      detailed_errors: data.maiores_erros,
      detailed_wins: data.maiores_acertos,
      error_checklist: data.checklist_erros_recorrentes,
      stage_analysis: data.analise_por_etapa,
      action_plan: data.plano_de_acao_direto,
      
      // Closer classification (derived from score)
      closer_classification: data.nota_geral && data.nota_geral >= 9 ? "elite" 
        : data.nota_geral && data.nota_geral >= 8 ? "alta_performance"
        : data.nota_geral && data.nota_geral >= 7 ? "avancado"
        : data.nota_geral && data.nota_geral >= 5 ? "intermediario"
        : "iniciante",
      closer_justification: data.justificativa_nota_geral?.join(" "),
    };

    console.log("Analysis complete, client:", analysis.client_name, "score:", analysis.call_score);

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    console.error("Error in analyze-call:", error);
    
    // Check if it was a timeout abort
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("Returning 408 timeout response");
      return new Response(
        JSON.stringify({ error: "Analysis timeout - transcription too long, partial analysis not possible" }),
        { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
