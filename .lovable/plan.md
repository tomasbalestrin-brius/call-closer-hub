

# Corrigir sistema de juncao de calls

## Problema

O erro nos logs e claro:
```
invalid input syntax for type integer: "7.5"
```

A coluna `score` na tabela `calls` e do tipo `integer`, mas a analise da IA retorna notas decimais como `7.5`. A edge function `merge-and-reanalyze` tenta gravar esse valor diretamente, causando o erro do Postgres.

## Solucao

### `supabase/functions/merge-and-reanalyze/index.ts`

Arredondar o score antes de salvar no banco:

```text
score: Math.round(analysis.call_score),
```

Tambem adicionar `Math.round` na observacao da call secundaria para garantir consistencia:

```text
observation: `Call mesclada com call principal (...). Nota combinada: ${Math.round(analysis.call_score)}`
```

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/merge-and-reanalyze/index.ts` | `Math.round()` no score antes de gravar |

