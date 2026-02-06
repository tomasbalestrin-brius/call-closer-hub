
# Corrigir Timeout de Análise e Metadados de Análise Parcial

## Problema 1: "Empty Response" em imports (Falha Critica)

O que acontece hoje:
- Arquivos menores que 100KB vao para analise "direta" (sem chunking)
- A analise direta chama `callOpenAI()` sem nenhum timeout interno
- Se a OpenAI demora mais que ~150s (limite do Edge Runtime), a funcao e encerrada abruptamente pelo runtime, resultando em "Empty response"
- Mesmo arquivos que usam chunking podem falhar se a analise total ultrapassa o limite

**Causa raiz**: A analise direta nao tem protecao de timeout. O `abortController` so e usado no path de chunking.

### Correcao

1. **Envolver a analise direta com `withTimeout`** para que, se a OpenAI demorar demais, a funcao retorne um erro controlado (408) em vez de morrer silenciosamente
2. **Reduzir `MAX_SIZE_FOR_DIRECT` de 100KB para 60KB** - Forcando mais arquivos a usar o path de chunking que ja tem protecao de timeout
3. **Adicionar `signal: abortSignal` nas chamadas fetch para OpenAI** no `callOpenAI` - Permitindo cancelamento gracioso quando o timeout dispara
4. **Envolver o bloco de analise direta em `withTimeout`** usando `ANALYSIS_TIMEOUT` como limite

### Mudancas no codigo (`analyze-call/index.ts`)

```text
Linha 27: MAX_SIZE_FOR_DIRECT = 60000 (era 100000)
Linha 1500: callOpenAI recebe abortSignal opcional
Linha 1514: fetch passa signal: abortSignal
Linhas 2084-2090: Envolver callOpenAI + parse com withTimeout e fallback
```

Se a analise direta expirar, o sistema:
1. Loga o timeout
2. Retorna resposta 408 com mensagem clara
3. O `process-user-files` trata o 408 como retryable e tenta novamente

---

## Problema 4: Metadados de analise parcial nao salvos

**Causa raiz**: Na linha 2230, o codigo usa `data.__metadata` para buscar os metadados, mas o campo correto e `data.analysis_metadata` (definido nas linhas 1494 e 2093). Resultado: o campo **sempre** cai no fallback padrao que diz `is_partial_analysis: false`.

### Correcao

Alterar a linha 2230 de:
```typescript
analysis_metadata: data.__metadata || { ... }
```

Para:
```typescript
analysis_metadata: data.analysis_metadata || { ... }
```

Isso garante que:
- Analises parciais (chunked com timeout) serao corretamente marcadas como `is_partial_analysis: true`
- Sinteses de emergencia serao marcadas como `is_emergency_synthesis: true`
- O alerta visual no `CallDetailDialog` finalmente aparecera para calls com analise incompleta

---

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/analyze-call/index.ts` linha 27 | `MAX_SIZE_FOR_DIRECT = 60000` |
| `supabase/functions/analyze-call/index.ts` linha 1500 | `callOpenAI` recebe `abortSignal?` |
| `supabase/functions/analyze-call/index.ts` linha 1514 | Adicionar `signal` ao fetch |
| `supabase/functions/analyze-call/index.ts` linhas 2084-2090 | Proteger analise direta com `withTimeout` |
| `supabase/functions/analyze-call/index.ts` linha 2230 | `data.analysis_metadata` (corrigir bug `__metadata`) |

## Detalhes Tecnicos

### Analise direta com timeout (linhas 2084-2101)

```typescript
// Analise direta COM protecao de timeout
const directTimeout = ANALYSIS_TIMEOUT - (Date.now() - startTime);
const masterResponse = await withTimeout(
  callOpenAI(MASTER_PROMPT, transcription, abortController.signal),
  directTimeout,
  null
);

if (!masterResponse) {
  console.log("Direct analysis timed out, returning 408");
  clearTimeout(timeoutId);
  return new Response(
    JSON.stringify({ error: "Analysis timeout on direct mode" }),
    { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

### callOpenAI com signal (linha 1500)

```typescript
async function callOpenAI(
  systemPrompt: string,
  transcription: string,
  abortSignal?: AbortSignal
): Promise<string> {
  // ... existing code ...
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: abortSignal, // <-- NOVO
    headers: { ... },
    body: JSON.stringify({ ... }),
  });
}
```

### Necessidade de variavel startTime no serve()

Adicionar `const startTime = Date.now()` no inicio do handler para calcular o timeout restante na analise direta.
