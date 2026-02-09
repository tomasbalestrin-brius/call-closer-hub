
# Sync Automatico do Google Drive via Cron

## Problema

Hoje a verificacao de novos arquivos no Drive so acontece quando o closer ou admin clica manualmente. Os campos `drive_auto_import` e `drive_import_frequency` existem na base mas nao estao conectados a nenhum agendamento real. Todos os 6 closers conectados tem `drive_auto_import = true`.

## Solucao

Criar uma edge function orquestradora (`auto-sync-drive`) que busca todos os closers com auto-import ativo e chama `sync-drive-files` para cada um. Agendar via `pg_cron` para rodar a cada 30 minutos.

## Arquivos a Criar/Alterar

### 1. Criar edge function: `supabase/functions/auto-sync-drive/index.ts`

Funcao orquestradora que:
- Consulta `profiles` filtrando `google_connected = true` e `drive_auto_import = true`
- Para cada usuario encontrado, chama `sync-drive-files` passando o `userId`
- Processa sequencialmente (um closer por vez) para evitar sobrecarga
- Loga quantos usuarios foram sincronizados e resultados
- Inclui delay de 2s entre usuarios para nao sobrecarregar a API do Google

### 2. Adicionar config em `supabase/config.toml`

```
[functions.auto-sync-drive]
verify_jwt = false
```

### 3. Criar cron job via SQL (executado manualmente, nao via migration)

Habilitar as extensoes `pg_cron` e `pg_net`, e agendar a funcao para rodar a cada 30 minutos:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'auto-sync-drive-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://eevsyfgtlumaaslgeyib.supabase.co/functions/v1/auto-sync-drive',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVldnN5Zmd0bHVtYWFzbGdleWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTkyNTEsImV4cCI6MjA4MzE5NTI1MX0.uA8AJtvQQ4lz3rlUUYH0Xi3wvPNm8TEfFvUZBaAWoTE"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Fluxo

```text
pg_cron (a cada 30 min)
  |
  v
auto-sync-drive (orquestrador)
  |
  +--> Para cada closer com google_connected + auto_import:
         |
         +--> sync-drive-files (userId)
                |
                +--> list-drive-files (verifica novos)
                +--> import-and-analyze (processa novos)
```

## Detalhes Tecnicos

- A funcao `auto-sync-drive` usa `SUPABASE_SERVICE_ROLE_KEY` para consultar perfis e chamar as outras funcoes
- Timeout seguro: como `sync-drive-files` processa ate 20 arquivos sequencialmente, o orquestrador aguarda ate 5 minutos por closer
- Se um closer falhar, o erro e logado e o proximo closer e processado normalmente
- O cron de 30 minutos e conservador o suficiente para nao estourar limites da API do Google Drive
