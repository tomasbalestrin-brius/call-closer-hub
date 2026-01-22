
# Plano: Otimização do Sistema de Análise com Timeout Seguro

## Diagnóstico do Problema

O sistema já possui chunking implementado no `analyze-call`, porém há um gargalo:

```text
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│  import-and-analyze     │────▶│  analyze-call           │────▶│  OpenAI API             │
│                         │     │                         │     │                         │
│  Aguarda resposta       │     │  Processa N chunks      │     │  gpt-4o-mini (chunks)   │
│  (até 150s limit)       │     │  + merge final          │     │  gpt-4o-mini (merge)    │
│                         │     │  (sem timeout interno)  │     │                         │
│  TIMEOUT 504 ⚠️         │     │  Pode exceder 150s      │     │  10-30s por chamada     │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

**Problema**: Para transcrições muito longas (>100KB), o processamento de 5-10 chunks + merge pode ultrapassar o limite de execução da Edge Function (~150 segundos).

## Solução: Timeout Interno + Paralelismo Otimizado

### Correção 1: Adicionar Timeout Seguro no `analyze-call`

**Arquivo:** `supabase/functions/analyze-call/index.ts`

Adicionar AbortController com timeout de 90 segundos para garantir que a função sempre responda antes do limite do Edge Function:

```typescript
// No início da função serve()
const FUNCTION_TIMEOUT = 90000; // 90 segundos - margem de segurança

serve(async (req) => {
  // Setup abort controller for function timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, FUNCTION_TIMEOUT);

  try {
    // ... lógica existente ...
    
    // Passar signal para chamadas OpenAI
    const response = await fetch("...", {
      signal: abortController.signal,
      // ... resto
    });
    
  } catch (error) {
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: "Analysis timeout - transcription too long" }),
        { status: 408 }
      );
    }
    // ... tratamento normal
  } finally {
    clearTimeout(timeoutId);
  }
});
```

### Correção 2: Aumentar Paralelismo dos Chunks

**Arquivo:** `supabase/functions/analyze-call/index.ts`

Atualmente processa 2 chunks por vez. Aumentar para 4 chunks paralelos:

```typescript
// Linha ~1196
// Antes: const batchSize = 2;
const batchSize = 4; // Mais paralelismo = menos tempo total
```

### Correção 3: Reduzir Delay Entre Batches

**Arquivo:** `supabase/functions/analyze-call/index.ts`

Remover o delay de 1 segundo entre batches (já temos throttling no process-user-files):

```typescript
// Linha ~1207-1209 - REMOVER este bloco:
// if (i + batchSize < chunks.length) {
//   await new Promise(resolve => setTimeout(resolve, 1000));
// }
```

### Correção 4: Fallback para Análise Parcial

Se o timeout for atingido durante o processamento de chunks, retornar análise parcial com os chunks já processados ao invés de falhar completamente:

```typescript
async function analyzeWithChunking(transcription: string, fileName: string, signal?: AbortSignal): Promise<AnalysisData> {
  const chunks = splitTranscription(transcription);
  const partialAnalyses: ChunkAnalysis[] = [];
  const batchSize = 4;
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    // Verificar se foi abortado
    if (signal?.aborted) {
      console.log(`Timeout reached at chunk ${i}/${chunks.length}, returning partial analysis`);
      break;
    }
    
    const batch = chunks.slice(i, i + batchSize);
    const batchPromises = batch.map((chunk, batchIdx) => 
      analyzeChunk(chunk, i + batchIdx + 1, chunks.length, signal)
    );
    
    const batchResults = await Promise.all(batchPromises);
    partialAnalyses.push(...batchResults);
  }
  
  // Mesmo com análise parcial, fazer o merge do que temos
  if (partialAnalyses.length > 0) {
    return await mergeChunkAnalyses(partialAnalyses);
  }
  
  throw new Error("No chunks analyzed before timeout");
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/analyze-call/index.ts` | Timeout de 90s + batch size 4 + fallback parcial |

## Resultado Esperado

- **Antes**: Calls longas (>1h) causam timeout 504
- **Depois**: 
  - Processamento mais rápido (4 chunks paralelos)
  - Timeout controlado (90s máximo)
  - Fallback gracioso (análise parcial se necessário)
  - Zero erros "Empty response from function"

## Estimativa de Tempo por Cenário

| Tamanho Call | Chunks | Tempo Antes | Tempo Depois |
|--------------|--------|-------------|--------------|
| 30min (~40KB) | 1 (direto) | 20-30s | 20-30s |
| 1h (~80KB) | 3 | 60-90s | 30-45s |
| 2h (~150KB) | 6 | 120-180s (TIMEOUT) | 45-60s |
| 3h (~220KB) | 9 | TIMEOUT | 60-75s |
