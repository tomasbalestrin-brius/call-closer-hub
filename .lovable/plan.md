
# Plano de Correção: Erros de Merge Timeout

## Diagnóstico

Os erros nas calls mostrados na imagem são de **3 tipos**:

| Erro | Quantidade | Causa |
|------|-----------|-------|
| "Merge timed out - returning partial data not possible" | 8 | O merge expira antes de consolidar os chunks |
| "Failed to parse AI response as JSON" | 3 | O JSON retornado pela OpenAI está malformado |
| "Empty response from function" | 2 | Timeout total da Edge Function |

O problema principal está na linha 1362-1364 do `analyze-call/index.ts`:
```typescript
if (!mergedAnalysis) {
  throw new Error("Merge timed out - returning partial data not possible");
}
```

Quando o merge expira, a função **lança um erro** em vez de **retornar dados parciais**. Isso é contraditório com a arquitetura de "análise parcial" que foi implementada.

---

## Solução: Fallback para Análise Parcial Sintética

Quando o merge expirar, ao invés de falhar, o sistema deve **construir uma análise parcial sintética** a partir dos chunks já processados, sem chamar a OpenAI novamente.

### Mudanças no código

**1. Criar função `buildPartialAnalysisFromChunks`**

Nova função que consolida os chunks localmente (sem chamar a API):
- Extrai identificação do primeiro chunk que tiver dados
- Combina dados extraídos de todos os chunks
- Calcula nota média das etapas
- Marca como análise de emergência no metadata

**2. Modificar lógica de fallback no `analyzeWithChunking`**

Alterar linhas 1356-1364 para:
```typescript
let mergedAnalysis = await withTimeout(
  mergeChunkAnalyses(partialAnalyses),
  mergeTimeout,
  null
);

// NOVO: Se merge expirou, construir análise sintética local
if (!mergedAnalysis) {
  console.log("⚠️ Merge timed out, building synthetic partial analysis...");
  mergedAnalysis = buildPartialAnalysisFromChunks(partialAnalyses);
}
```

**3. Adicionar flag `is_emergency_synthesis` ao metadata**

Para diferenciar entre:
- Análise parcial (alguns chunks processados)
- Análise de emergência (merge falhou, síntese local)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/analyze-call/index.ts` | Adicionar função de síntese local + alterar lógica de fallback |

---

## Implementação Detalhada

### Nova Função: `buildPartialAnalysisFromChunks`

```typescript
function buildPartialAnalysisFromChunks(chunks: ChunkAnalysis[]): AnalysisData {
  console.log(`🔧 Building synthetic analysis from ${chunks.length} chunks (merge fallback)`);
  
  // Extrair identificação do primeiro chunk com dados
  const identificacao = chunks.reduce((acc, chunk) => {
    if (!acc.nome_lead && chunk.identificacao?.nome_lead) 
      acc.nome_lead = chunk.identificacao.nome_lead;
    if (!acc.nome_closer && chunk.identificacao?.nome_closer) 
      acc.nome_closer = chunk.identificacao.nome_closer;
    if (!acc.produto_ofertado && chunk.identificacao?.produto_ofertado) 
      acc.produto_ofertado = chunk.identificacao.produto_ofertado;
    if (acc.houve_venda === 'nao_identificado' && chunk.identificacao?.houve_venda) 
      acc.houve_venda = chunk.identificacao.houve_venda;
    return acc;
  }, { nome_lead: null, nome_closer: null, produto_ofertado: null, houve_venda: 'nao_identificado' });
  
  // Combinar dados extraídos
  const dadosExtraidos = chunks.reduce((acc, chunk) => {
    const d = chunk.dados_extraidos || {};
    if (d.nicho_profissao) acc.nicho_profissao = d.nicho_profissao;
    if (d.faturamento) acc.faturamento_mensal_bruto = d.faturamento;
    if (d.dor_principal) acc.dor_principal_declarada = { texto: d.dor_principal, evidencia: '' };
    if (d.dor_profunda) acc.dor_profunda = { texto: d.dor_profunda, evidencia: '' };
    if (d.objecoes?.length) {
      acc.objecoes_levantadas = d.objecoes.map(o => ({ objecao: o, evidencia: '' }));
    }
    return acc;
  }, {} as any);
  
  // Calcular nota média das etapas encontradas
  const todasEtapas = chunks.flatMap(c => c.etapas_identificadas || []);
  const notaMedia = todasEtapas.length > 0 
    ? Math.round(todasEtapas.reduce((sum, e) => sum + (e.nota || 0), 0) / todasEtapas.length * 10) / 10
    : 5;
  
  // Coletar observações
  const pontosFortes = [...new Set(chunks.flatMap(c => c.observacoes?.pontos_fortes_gerais || []))];
  const pontosFracos = [...new Set(chunks.flatMap(c => c.observacoes?.pontos_fracos_gerais || []))];
  
  return {
    framework_selecionado: identificacao.produto_ofertado || 'Não identificado',
    confianca_framework: 0.5,
    motivo_escolha_framework: ['Análise de emergência - merge expirou'],
    identificacao,
    dados_extraidos: dadosExtraidos,
    nota_geral: notaMedia,
    justificativa_nota_geral: ['Nota calculada automaticamente pela média das etapas (síntese de emergência)'],
    maiores_acertos: pontosFortes.slice(0, 3).map(p => ({
      acerto: p,
      evidencia: 'Extraído de análise parcial',
      porque_importa: '',
      como_repetir: ''
    })),
    maiores_erros: pontosFracos.slice(0, 3).map(p => ({
      erro: p,
      evidencia: 'Extraído de análise parcial',
      impacto: '',
      como_corrigir: [],
      frase_pronta: { antes: '', depois: '' }
    })),
    ponto_de_perda_da_venda: null,
    sinais_da_perda: [],
    se_vendeu: { porque_comprou: [], gatilhos_que_mais_pesaram: [] },
    tomador_decisao: { presente: false, evidencia: null, reagendamento_realizado: false },
    checklist_erros_recorrentes: {},
    analise_por_etapa: {},
    plano_acao_direto: [],
    seeds_prova_social: [],
    call_score: Math.round(notaMedia * 10),
    technical_analysis: null,
    ai_summary: `Análise de emergência baseada em ${chunks.length} chunks. Merge expirou antes de completar. Recomenda-se reanálise.`,
    main_errors: pontosFracos.slice(0, 3),
    main_wins: pontosFortes.slice(0, 3),
    consciousness_level: 'Problema' as any,
    decision_reason: null,
    lead_classification: 'Não Identificado' as any,
    loss_point: null,
    closer_classification: 'Regular' as any,
    analysis_metadata: {
      is_partial_analysis: true,
      chunks_analyzed: chunks.length,
      chunks_total: chunks.length,
      confidence_level: 'low' as const,
      analysis_method: 'chunked' as const,
      timeout_occurred: true,
      is_emergency_synthesis: true // NOVO FLAG
    }
  } as AnalysisData;
}
```

### Modificar `analyzeWithChunking` (linhas 1356-1385)

```typescript
// Linha 1356-1364 - ANTES:
const mergedAnalysis = await withTimeout(
  mergeChunkAnalyses(partialAnalyses),
  mergeTimeout,
  null
);

if (!mergedAnalysis) {
  throw new Error("Merge timed out - returning partial data not possible");
}

// DEPOIS:
let mergedAnalysis = await withTimeout(
  mergeChunkAnalyses(partialAnalyses),
  mergeTimeout,
  null
);

// Se merge expirou, construir análise sintética localmente
if (!mergedAnalysis) {
  console.log("⚠️ Merge timed out, building synthetic partial analysis from chunks...");
  mergedAnalysis = buildPartialAnalysisFromChunks(partialAnalyses);
  console.log(`✅ Synthetic analysis built with score ${mergedAnalysis.call_score}`);
}
```

---

## Resultado Esperado

Após a correção:

| Cenário | Antes | Depois |
|---------|-------|--------|
| Merge expira | ❌ Erro "Merge timed out" | ✅ Análise sintética salva |
| Usuário vê | 🔴 Badge "Erro" | 🟡 Badge "Análise Parcial" |
| Dados salvos | Nenhum | Identificação + nota média + observações |
| Reprocessamento | Obrigatório | Opcional (dados já úteis) |

---

## Atualização do Metadata Interface

Adicionar novo campo ao tipo `AnalysisMetadata`:

```typescript
interface AnalysisMetadata {
  is_partial_analysis?: boolean;
  chunks_analyzed?: number;
  chunks_total?: number;
  confidence_level?: 'low' | 'high';
  analysis_method?: 'chunked' | 'direct';
  timeout_occurred?: boolean;
  is_emergency_synthesis?: boolean; // NOVO
}
```

---

## Sequência de Execução

```text
┌─────────────────────────────────────────────────────┐
│  PASSO 1: Adicionar função buildPartialAnalysis     │
│  → Nova função para síntese local de chunks         │
├─────────────────────────────────────────────────────┤
│  PASSO 2: Modificar analyzeWithChunking             │
│  → Usar síntese como fallback quando merge expira   │
├─────────────────────────────────────────────────────┤
│  PASSO 3: Atualizar interface AnalysisMetadata      │
│  → Adicionar flag is_emergency_synthesis            │
├─────────────────────────────────────────────────────┤
│  PASSO 4: Deploy automático                         │
│  → Edge function redeployada                        │
└─────────────────────────────────────────────────────┘
```

---

## Bonus: Reprocessar Arquivos com Erro

Após o deploy, os arquivos com erro "Merge timed out" podem ser reprocessados automaticamente ou via botão "Reimportar" - agora eles terão o fallback disponível.
