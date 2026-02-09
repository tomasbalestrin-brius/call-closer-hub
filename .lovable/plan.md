

# Plano de Correções do Sistema

## Problemas Identificados

1. **[CRITICO] RLS da tabela `system_logs` aberta ao publico** - A policy "Service role has full access" usa `roles={public}` com `USING (true)`, permitindo que qualquer pessoa nao autenticada leia ou delete logs do sistema.

2. **[CRITICO] JWT truncado no cron job 4 (`check-incomplete-clients`)** - O token termina em `...UUZBaAWoTE` em vez de `...UUYH0Xi3wvPNm8TEfFvUZBaAWoTE`. A funcao nunca esta sendo invocada com sucesso (zero registros nos edge logs).

3. **[ALTO] Cron jobs de sync redundantes e sobrecarregando a API** - Todos os 6 closers tem `drive_import_frequency = 'realtime'`. Com isso:
   - Job 5 (cada 10 min) sincroniza todos os 6 closers diretamente
   - Job 2 (cada 1h) sincroniza os mesmos 6 closers (filtro inclui "realtime")
   - Job 7 (cada 30 min) chama `auto-sync-drive` que sincroniza os mesmos 6
   - Resultado: ate 18 chamadas simultaneas por hora para os mesmos usuarios

4. **[MEDIO] `auto-sync-drive` possivelmente nao deployada** - Nenhum registro nos edge logs apesar do cron estar disparando. O Job 7 reporta "succeeded" mas isso so significa que o `net.http_post` foi enfileirado, nao que a funcao executou.

---

## Correções Planejadas

### 1. Corrigir RLS da tabela `system_logs`

Remover a policy insegura que da acesso total ao role `public` e substituir por uma que restrinja corretamente:

- Dropar: `Service role has full access to logs` (public, ALL, true)
- Criar: Policy de INSERT para `service_role` (usada pelas edge functions via service key)
- Manter: Policy existente de SELECT para admins autenticados

### 2. Corrigir JWT do cron job 4

Deletar o job 4 atual com JWT truncado e recriar com o token correto completo.

### 3. Eliminar cron jobs redundantes

Estrategia: manter apenas o **Job 7** (`auto-sync-drive`, cada 30 min) como unico responsavel pela sincronizacao automatica, pois ele ja tem logica de orquestracao, logging e controle de erros.

Remover:
- Job 2 (sync hourly/realtime - redundante)
- Job 3 (sync daily - coberto pelo auto-sync que roda a cada 30 min)
- Job 5 (sync realtime cada 10 min - redundante com job 7)

### 4. Garantir deploy do `auto-sync-drive`

Re-deployar a edge function para garantir que esteja ativa e acessivel.

---

## Detalhes Tecnicos

### SQL para correcoes de RLS e cron:

```sql
-- 1. Fix system_logs RLS
DROP POLICY "Service role has full access to logs" ON public.system_logs;

-- 2. Fix check-incomplete-clients cron (job 4) - delete and recreate with correct JWT
SELECT cron.unschedule(4);
SELECT cron.schedule(
  'check-incomplete-clients-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://eevsyfgtlumaaslgeyib.supabase.co/functions/v1/check-incomplete-clients',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVldnN5Zmd0bHVtYWFzbGdleWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTkyNTEsImV4cCI6MjA4MzE5NTI1MX0.uA8AJtvQQ4lz3rlUUYH0Xi3wvPNm8TEfFvUZBaAWoTE"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- 3. Remove redundant sync jobs (keep only job 7 = auto-sync-drive)
SELECT cron.unschedule(2);
SELECT cron.unschedule(3);
SELECT cron.unschedule(5);
```

### Re-deploy da edge function

Forcar o deploy do `auto-sync-drive` para garantir que esta ativa no ambiente.

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| `system_logs` acessivel sem autenticacao | Apenas admins podem ler, service role pode inserir |
| `check-incomplete-clients` falhando silenciosamente | Executando corretamente a cada hora |
| 3 cron jobs redundantes sincronizando Drive | 1 unico job (`auto-sync-drive`) a cada 30 min |
| `auto-sync-drive` possivelmente offline | Deployada e verificada |

