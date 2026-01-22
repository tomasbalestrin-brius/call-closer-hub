

# Plano: Corrigir Timeout Parcial no analyze-call

## Problema Identificado

O timeout interno de 90s está funcionando, porém quando é acionado **durante** um batch de chamadas OpenAI, a função é encerrada pelo Edge Runtime antes de conseguir retornar a análise parcial.

```text
Cenário problemático:
┌───────────────────────────────────────────────────────────────┐
│  0s          30s         60s         90s        120s    150s  │
│  │──────────────│──────────────│──────────────│─────────│     │
│  │   Batch 1    │   Batch 2 (processando...)  │         │     │
│  │  (completo)  │ ←── timeout 90s dispara ──→ │  KILL   │     │
│  │              │   mas batch 2 ainda roda    │   ⚠️    │     │
│  │              │   função morre sem resposta │         │     │
└───────────────────────────────────────────────────────────────┘
```

## Solução: Timeout Rigoroso com Racing

Implementar `Promise.race` para forçar retorno imediato quando o timeout for atingido, independente do estado das chamadas OpenAI.

## Modificações Necessárias

### Arquivo: `supabase/functions/analyze-call/index.ts`

#### 1. Adicionar Função de Racing com Timeout

```typescript
// Após a constante FUNCTION_TIMEOUT (linha ~13)
const ANALYSIS_TIMEOUT = 85000; // 85 segundos para análise (5s antes do abort)

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T | null = null): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<T | null>((resolve) => 
      setTimeout(() => {
        console.log(`Promise timeout reached (${ms}ms), returning fallback`);
        resolve(fallback);
      }, ms)
    )
  ]);
}
```

#### 2. Modificar analyzeWithChunking para Racing

```typescript
async function analyzeWithChunking(
  transcription: string, 
  fileName: string,
  abortSignal?: AbortSignal
): Promise<AnalysisData> {
  console.log(`Starting chunked analysis for file: ${fileName}`);
  console.log(`Transcription length: ${transcription.length} chars`);
  
  const startTime = Date.now();
  const chunks = splitTranscription(transcription);
  console.log(`Split into ${chunks.length} chunks for parallel processing`);
  
  const partialAnalyses: ChunkAnalysis[] = [];
  const batchSize = 4;
  const BATCH_TIMEOUT = 40000; // 40s máximo por batch
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    // Verificar tempo restante
    const elapsed = Date.now() - startTime;
    const remaining = ANALYSIS_TIMEOUT - elapsed;
    
    if (remaining < 10000 || abortSignal?.aborted) {
      console.log(`Time limit approaching (${Math.round(elapsed/1000)}s elapsed), stopping with ${partialAnalyses.length} chunks`);
      break;
    }
    
    const batch = chunks.slice(i, i + batchSize);
    const batchPromises = batch.map((chunk, batchIdx) => 
      analyzeChunk(chunk, i + batchIdx + 1, chunks.length)
    );
    
    // Racing: ou batch completa, ou timeout de batch dispara
    const batchTimeout = Math.min(BATCH_TIMEOUT, remaining - 5000);
    const batchResult = await withTimeout(
      Promise.all(batchPromises),
      batchTimeout,
      null
    );
    
    if (batchResult === null) {
      console.log(`Batch ${Math.floor(i/batchSize) + 1} timed out, proceeding with ${partialAnalyses.length} chunks`);
      break;
    }
    
    partialAnalyses.push(...batchResult);
    console.log(`Batch ${Math.floor(i/batchSize) + 1} completed: ${partialAnalyses.length}/${chunks.length} chunks (${Math.round((Date.now() - startTime)/1000)}s elapsed)`);
  }
  
  if (partialAnalyses.length === 0) {
    throw new Error("No chunks analyzed before timeout - transcription may be too long");
  }
  
  // Merge com timeout também
  const mergeTimeout = Math.max(ANALYSIS_TIMEOUT - (Date.now() - startTime) - 2000, 10000);
  console.log(`Merging ${partialAnalyses.length}/${chunks.length} chunks with ${Math.round(mergeTimeout/1000)}s timeout...`);
  
  const mergedAnalysis = await withTimeout(
    mergeChunkAnalyses(partialAnalyses),
    mergeTimeout,
    null
  );
  
  if (!mergedAnalysis) {
    throw new Error("Merge timed out");
  }
  
  return mergedAnalysis;
}
```

#### 3. Garantir Resposta Antes do Encerramento

No handler principal, adicionar um fallback final:

```typescript
serve(async (req) => {
  // ... código existente ...
  
  const startTime = Date.now();
  
  try {
    // ... código de análise ...
    
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    
    const elapsed = Date.now() - startTime;
    console.error(`Error in analyze-call after ${Math.round(elapsed/1000)}s:`, error);
    
    // ... tratamento de erro existente ...
  }
});
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/analyze-call/index.ts` | Racing timeout em batches + merge |

## Benefícios

- **Resposta garantida**: Função sempre retorna antes do limite do Edge
- **Análise parcial**: Retorna o que foi processado até o timeout
- **Zero "Empty response"**: Erros substituídos por análises parciais

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Call 1h (~80KB) | ✅ OK | ✅ OK |
| Call 2h (~150KB) | ❌ Empty response | ✅ Análise parcial (2-3 chunks) |
| Call 3h (~220KB) | ❌ Empty response | ✅ Análise parcial (2-4 chunks) |

