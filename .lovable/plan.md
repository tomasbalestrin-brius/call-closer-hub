
# Corrigir "Empty Response" nos 12 Arquivos com Erro

## Diagnostico

Existem **12 arquivos** com erro "Empty response from function". A causa raiz e dupla:

1. **`analyze-call` morre pelo Edge Runtime** (~150s) antes de responder, resultando em corpo vazio (nao retorna 408)
2. **`import-and-analyze` so faz retry em status 408**, mas quando o runtime mata a funcao, o status pode ser 200 com corpo vazio -- nao e retentado

O fix anterior (adicionar `withTimeout` na analise direta) ajuda para novas chamadas, mas:
- Nao resolve os 12 arquivos ja com erro
- Nao cobre o cenario onde o runtime mata a funcao antes do `withTimeout` agir (ex: a propria rede retorna vazio)

## Solucao em 3 partes

### Parte 1: Retry em "Empty response" no `import-and-analyze`

Atualmente so faz retry para `status === 408`. Precisa tambem fazer retry quando `analyzeParseError === "Empty response from function"`.

**Arquivo**: `supabase/functions/import-and-analyze/index.ts` (linhas 546-552)

Alterar de:
```typescript
// Retry only for timeouts (408)
if (analyzeResponse.status === 408 && retryCount < MAX_RETRIES_ON_TIMEOUT) {
```

Para:
```typescript
// Retry for timeouts (408) AND empty responses (runtime killed the function)
const isRetryable = analyzeResponse.status === 408 || analyzeParseError === "Empty response from function";
if (isRetryable && retryCount < MAX_RETRIES_ON_TIMEOUT) {
```

### Parte 2: Adicionar `AbortSignal` com timeout na chamada fetch do `import-and-analyze`

O `import-and-analyze` chama `analyze-call` sem timeout proprio. Se `analyze-call` morrer, o fetch fica pendurado ate o Edge Runtime matar `import-and-analyze` tambem.

**Arquivo**: `supabase/functions/import-and-analyze/index.ts` (linhas 522-535)

Adicionar `AbortController` com timeout de 120s:
```typescript
const analyzeController = new AbortController();
const analyzeTimeout = setTimeout(() => analyzeController.abort(), 120000);

analyzeResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-call`, {
  method: "POST",
  signal: analyzeController.signal,
  headers: { ... },
  body: JSON.stringify({ ... }),
});

clearTimeout(analyzeTimeout);
```

E tratar `AbortError` como retryable no catch.

### Parte 3: Resetar os 12 arquivos com erro para "pending"

Os arquivos ja marcados como `error` com "Empty response" precisam ser resetados para `pending` para serem reprocessados automaticamente.

**Migracao SQL**:
```sql
UPDATE imported_files 
SET status = 'pending', 
    error_message = NULL, 
    started_processing_at = NULL,
    retry_count = 0
WHERE status = 'error' 
  AND error_message LIKE '%Empty response from function%';
```

Tambem resetar o arquivo com erro "No chunks analyzed before timeout":
```sql
UPDATE imported_files 
SET status = 'pending', 
    error_message = NULL, 
    started_processing_at = NULL,
    retry_count = 0
WHERE status = 'error' 
  AND error_message LIKE '%No chunks analyzed before timeout%';
```

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `import-and-analyze/index.ts` linhas 546-552 | Retry tambem em "Empty response" |
| `import-and-analyze/index.ts` linhas 519-535 | `AbortController` com 120s timeout no fetch |
| `import-and-analyze/index.ts` linhas 554-556 | Tratar `AbortError` como retryable |
| Migration SQL | Resetar 13 arquivos com erro para "pending" |

## Resultado esperado

- Novas importacoes: se `analyze-call` morrer, `import-and-analyze` faz ate 2 retries automaticos
- Se o fetch pendurar, o `AbortController` corta em 120s e tenta novamente
- Os 13 arquivos existentes com erro voltam para a fila e serao reprocessados
- Combinado com o fix anterior (timeout na analise direta do `analyze-call`), a taxa de sucesso deve subir significativamente
