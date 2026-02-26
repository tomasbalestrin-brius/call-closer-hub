

# Reprocessamento dos arquivos com erro + correção de timeout

## Diagnóstico

Existem **3 arquivos** travados com status `error` no banco:

| Closer | Arquivo | Erro |
|--------|---------|------|
| Gisele | fof-hbzc-qyr (25/02) | Timeout |
| Hannah | vbe-abyj-ywe (24/02) | Timeout |
| Leandro | yrk-kuuy-jii (20/02) | Failed to export document |

Os system_logs mostram 36+ ocorrências de "No chunks analyzed before timeout" — são retentativas repetidas dos mesmos arquivos falhando.

## Causa raiz do timeout

O erro "No chunks analyzed before timeout" ocorre na linha 1608 de `analyze-call/index.ts` quando **nenhum chunk** do primeiro batch completa dentro do `BATCH_TIMEOUT` (atualmente **50 segundos**).

O problema: a função `analyzeChunk` tem retry interno com 3 tentativas e backoff exponencial. Se a primeira tentativa demora 30s e falha, o retry consome mais 30s, totalizando 60s+ — ultrapassando o BATCH_TIMEOUT de 50s. Resultado: o `withTimeout` retorna `null` e o sistema descarta o batch inteiro, mesmo que os chunks estivessem quase prontos.

## Plano de correção (2 partes)

### Parte 1: Corrigir timeout em `analyze-call/index.ts`

- **BATCH_TIMEOUT**: Aumentar de `50000` (50s) para `80000` (80s)
  - Dá margem para 1 retry completo dentro do batch
- **ANALYSIS_TIMEOUT**: Manter em `130000` (130s) — OK
- **FUNCTION_TIMEOUT**: Manter em `145000` (145s) — OK

### Parte 2: Aumentar timeout do fetch em `import-and-analyze/index.ts`

- Linha 551: AbortController timeout de `120000` (120s) → `140000` (140s)
  - Alinhado com o ANALYSIS_TIMEOUT de 130s + margem

### Parte 3: Resetar os 3 arquivos para reprocessamento

Após deploy das correções, resetar os 3 registros de `error` para `pending` via update no banco, limpando `error_message` e `started_processing_at`.

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/analyze-call/index.ts` | `BATCH_TIMEOUT`: 50000 → 80000 |
| `supabase/functions/import-and-analyze/index.ts` | AbortController timeout: 120000 → 140000 |
| SQL migration | Reset 3 arquivos: status `error` → `pending` |

