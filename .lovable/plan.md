

# Reanálise da call Nathalia Gadelha — Problema e Solução

## Situação atual

A call de **Nathalia Gadelha** (ID: `40584ecf`, closer: Hannah, 02/03/2026) tem uma transcrição de **110.784 caracteres**. A função `reanalyze-call` envia toda a transcrição de uma vez para o OpenAI, o que causa timeout para transcrições grandes (>30K caracteres).

A função `analyze-call` já tem um pipeline de chunks que lida com transcrições grandes, mas `reanalyze-call` não usa esse pipeline.

## Plano

### Opção: Chamar `analyze-call` a partir de `reanalyze-call` para transcrições grandes

Em `supabase/functions/reanalyze-call/index.ts`:

1. Adicionar verificação do tamanho da transcrição (threshold: 30.000 caracteres)
2. Se a transcrição for maior que o threshold, em vez de chamar OpenAI diretamente, fazer um fetch interno para `analyze-call` passando a transcrição — que já tem o pipeline de chunking
3. Mapear o resultado do `analyze-call` para o mesmo formato de update que `reanalyze-call` usa
4. Para transcrições menores, manter o comportamento atual (chamada direta ao OpenAI)

### Arquivo a editar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/reanalyze-call/index.ts` | Adicionar fallback para `analyze-call` quando transcrição > 30K chars |

### Após o deploy

Disparar novamente a reanálise da call `40584ecf` da Nathalia Gadelha.

