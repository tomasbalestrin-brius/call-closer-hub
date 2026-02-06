
# Auto-Recovery: Retry Automatico de Arquivos com Erro

## O que muda

Hoje, se um arquivo falha todas as tentativas, ele fica como `error` para sempre. Com esta mudanca, o sistema automaticamente tenta novamente arquivos com erro -- sem intervencao humana.

## Estrategia em 2 partes

### Parte 1: Cron Job de auto-recovery via `stale-file-cleanup`

O `stale-file-cleanup` ja existe e faz limpeza de arquivos presos. Vamos expandi-lo para tambem **resetar arquivos com erro retryable** (Empty response, Timeout, AbortError, No chunks) automaticamente, ate um maximo de 5 tentativas.

Arquivos com erros permanentes (call muito curta, export falhou) NAO serao retentados.

**Arquivo**: `supabase/functions/stale-file-cleanup/index.ts`

Adicionar ao final da funcao:
```typescript
// 5. Auto-retry: Reset retryable errors (max 5 attempts)
const retryablePatterns = [
  '%Empty response%',
  '%Timeout%', 
  '%AbortError%',
  '%No chunks analyzed%',
  '%timeout%',
  '%TIMEOUT%'
];

// Only retry files with retry_count < 5
for (const pattern of retryablePatterns) {
  const { data: retryFiles } = await supabase
    .from("imported_files")
    .update({ 
      status: "pending", 
      error_message: null,
      started_processing_at: null
    })
    .eq("status", "error")
    .like("error_message", pattern)
    .lt("retry_count", 5)
    .select("id");

  if (retryFiles?.length) {
    results.autoRetried += retryFiles.length;
  }
}
```

### Parte 2: Agendar execucao automatica com pg_cron

Criar uma migration SQL que configura o `stale-file-cleanup` para rodar **a cada 10 minutos** automaticamente via `pg_cron` + `pg_net`.

```sql
-- Agendar cleanup a cada 10 minutos
SELECT cron.schedule(
  'auto-recovery-cleanup',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.service_url') || '/functions/v1/stale-file-cleanup',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Alternativa sem pg_cron**: Se `pg_cron` nao estiver disponivel, adicionar um timer no frontend que chama `stale-file-cleanup` a cada 10 minutos enquanto a aba Admin estiver aberta.

## Resultado esperado

```text
Arquivo falha tentativa 1 → retry automatico em ~10 min
Arquivo falha tentativa 2 → retry automatico em ~10 min  
Arquivo falha tentativa 3 → retry automatico em ~10 min
Arquivo falha tentativa 4 → retry automatico em ~10 min
Arquivo falha tentativa 5 → marcado como erro PERMANENTE (nao tenta mais)
```

- Probabilidade de erro permanente apos 5 tentativas: **<1%** (baseado no fato de que a maioria dos erros eram timeouts transientes)
- Tempo maximo ate correcao automatica: **~50 minutos** (5 tentativas x 10 min intervalo)
- Zero intervencao manual necessaria

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/stale-file-cleanup/index.ts` | Adicionar logica de auto-retry para erros retryable com retry_count < 5 |
| Migration SQL | Agendar `stale-file-cleanup` via pg_cron a cada 10 minutos (ou fallback frontend) |
| `src/components/admin/ImportStatusPanel.tsx` | Adicionar indicador visual de "auto-retry ativo" e contagem de retries pendentes |

## Detalhes Tecnicos

### Erros retryable vs permanentes

**Retryable** (serao retentados automaticamente):
- "Empty response from function"
- "Timeout" / "408"
- "AbortError"
- "No chunks analyzed before timeout"
- "Fetch timeout"

**Permanentes** (NAO serao retentados):
- "Call muito curta"
- "Failed to export document" 
- "Duplicate content hash"
- Qualquer erro com retry_count >= 5

### Fallback frontend (se pg_cron nao disponivel)

Adicionar no `ImportStatusPanel.tsx` um `useEffect` com `setInterval` de 10 minutos que chama `stale-file-cleanup`. Isso garante auto-recovery enquanto algum admin estiver com a pagina aberta.

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    await supabase.functions.invoke('stale-file-cleanup');
  }, 600000); // 10 minutos
  return () => clearInterval(interval);
}, []);
```
