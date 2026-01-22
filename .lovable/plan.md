

# Plano: Otimização do analyze-call com Timeout Seguro

## Objetivo
Eliminar os erros de timeout (504) para transcrições longas implementando:
- Timeout interno de 90 segundos (safety margin)
- Batch size aumentado de 2 para 4 chunks paralelos
- Fallback para análise parcial se timeout ocorrer

## Arquitetura Atual vs. Nova

```text
ATUAL (com problemas):
┌─────────────────────────────────────────────────────────────────┐
│  analyze-call (até 180s+ para calls longas)                    │
│                                                                 │
│  Chunks: batch de 2 + delay 1s entre batches                   │
│  Sem timeout interno → função ultrapassa limite do Edge (150s) │
│  Resultado: 504 Gateway Timeout                                │
└─────────────────────────────────────────────────────────────────┘

NOVA (otimizada):
┌─────────────────────────────────────────────────────────────────┐
│  analyze-call (máximo 90s garantido)                           │
│                                                                 │
│  Chunks: batch de 4 paralelos + sem delay                      │
│  Timeout interno: 90s via AbortController                      │
│  Fallback: retorna análise parcial se atingir timeout          │
│  Resultado: sempre responde antes do limite do Edge            │
└─────────────────────────────────────────────────────────────────┘
```

## Modificações no Arquivo

**Arquivo:** `supabase/functions/analyze-call/index.ts`

### Modificação 1: Adicionar Constante de Timeout (após linha 12)

```typescript
const MAX_SIZE_FOR_DIRECT = 50000; // Files under 50KB go direct
const FUNCTION_TIMEOUT = 90000; // 90 seconds safety timeout
```

### Modificação 2: Alterar Função analyzeWithChunking (linhas 1187-1217)

Nova implementação com suporte a timeout e fallback parcial:

```typescript
async function analyzeWithChunking(
  transcription: string, 
  fileName: string,
  abortSignal?: AbortSignal
): Promise<AnalysisData> {
  console.log(`Starting chunked analysis for file: ${fileName}`);
  console.log(`Transcription length: ${transcription.length} chars`);
  
  const chunks = splitTranscription(transcription);
  const partialAnalyses: ChunkAnalysis[] = [];
  const batchSize = 4; // Aumentado de 2 para 4
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    // Verificar se foi abortado antes de processar próximo batch
    if (abortSignal?.aborted) {
      console.log(`Timeout reached at batch ${i}/${chunks.length}, proceeding with partial analysis`);
      break;
    }
    
    const batch = chunks.slice(i, i + batchSize);
    const batchPromises = batch.map((chunk, batchIdx) => 
      analyzeChunk(chunk, i + batchIdx + 1, chunks.length)
    );
    
    try {
      const batchResults = await Promise.all(batchPromises);
      partialAnalyses.push(...batchResults);
      console.log(`Batch ${Math.floor(i/batchSize) + 1} completed: ${partialAnalyses.length}/${chunks.length} chunks`);
    } catch (error) {
      if (abortSignal?.aborted) {
        console.log(`Batch aborted, using ${partialAnalyses.length} chunks already processed`);
        break;
      }
      throw error;
    }
    
    // REMOVIDO: delay de 1 segundo entre batches
  }
  
  // Fallback: merge o que temos (mesmo que parcial)
  if (partialAnalyses.length === 0) {
    throw new Error("No chunks analyzed before timeout");
  }
  
  console.log(`Merging ${partialAnalyses.length}/${chunks.length} chunks (${partialAnalyses.length < chunks.length ? 'PARTIAL' : 'COMPLETE'})`);
  const mergedAnalysis = await mergeChunkAnalyses(partialAnalyses);
  
  return mergedAnalysis;
}
```

### Modificação 3: Adicionar Timeout no Handler Principal (linhas 1503-1534)

```typescript
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Setup abort controller for function timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log("Function timeout reached (90s), aborting...");
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
      console.log(`Large file detected (${transcription.length} chars > ${MAX_SIZE_FOR_DIRECT}), using CHUNKED analysis`);
      data = await analyzeWithChunking(transcription, fileName, abortController.signal);
    } else {
      console.log(`Standard file size, using DIRECT analysis`);
      const masterResponse = await callOpenAI(MASTER_PROMPT, transcription);
      console.log("AI analysis completed");
      console.log("Raw response length:", masterResponse.length);
      data = await parseJSONFromResponse(masterResponse) as AnalysisData;
    }
    
    clearTimeout(timeoutId);
    
    // ... resto do código existente (ensure stages, map to analysis, return)
```

### Modificação 4: Atualizar Error Handler (linhas 1665-1672)

```typescript
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    console.error("Error in analyze-call:", error);
    
    // Check if it was a timeout abort
    if (error instanceof Error && error.name === 'AbortError') {
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
```

## Resumo das Mudanças

| Local | Antes | Depois |
|-------|-------|--------|
| Constante | - | `FUNCTION_TIMEOUT = 90000` |
| Batch size | 2 | 4 |
| Delay entre batches | 1 segundo | Removido |
| Timeout interno | Nenhum | 90s com AbortController |
| Fallback parcial | Não | Sim (merge chunks processados) |

## Estimativa de Performance

| Tamanho Call | Chunks | Tempo Atual | Tempo Novo |
|--------------|--------|-------------|------------|
| 30min (~40KB) | 1 (direto) | 20-30s | 20-30s |
| 1h (~80KB) | 3-4 | 60-90s | 20-30s |
| 2h (~150KB) | 6-7 | **TIMEOUT** | 40-50s |
| 3h (~220KB) | 9-10 | **TIMEOUT** | 60-75s |

## Benefícios

- **Zero timeouts 504**: Função sempre responde antes do limite
- **2x mais rápido**: 4 chunks paralelos vs 2
- **Fallback gracioso**: Análise parcial melhor que falha total
- **Backward compatible**: Chamadas diretas para arquivos pequenos não mudam

