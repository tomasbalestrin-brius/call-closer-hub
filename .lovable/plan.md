
# Reduzir limite minimo de caracteres para 3000

## O que muda

O limite minimo de caracteres para aceitar uma call sera reduzido de **3750** para **3000** (equivalente a aproximadamente 3-4 minutos de conversa).

## Detalhe tecnico

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/import-and-analyze/index.ts` (linha 308) | Alterar `MIN_CONTENT_LENGTH = 3750` para `MIN_CONTENT_LENGTH = 3000` |

Apenas uma linha precisa ser alterada. O comentario na linha 307 tambem sera atualizado para refletir o novo valor (~4 minutos).
