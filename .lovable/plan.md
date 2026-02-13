

# Corrigir: reanálise não atualiza o campo `product` da call

## Problema encontrado

O `reanalyze-call` salva o `framework_selecionado` **apenas dentro do JSON** `technical_analysis`, mas **nunca atualiza a coluna `product`** da tabela `calls`. Como o UI (CallCard) exibe `call.product`, o framework antigo ("Mentoria Julia Ottoni") continua aparecendo mesmo após reanálise.

O `analyze-call` original faz isso corretamente (linha 2344: `product: data.identificacao?.produto_ofertado`), mas o `reanalyze-call` esquece de mapear.

## Correção

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/reanalyze-call/index.ts` (~linha 1112) | Adicionar mapeamento de `framework_selecionado` para a coluna `product` |

### Código a adicionar (após a linha 1117, antes do elapsed time log):

```typescript
// Atualizar product com o framework selecionado pela IA
if (analysis.framework_selecionado) {
  updateData.product = analysis.framework_selecionado;
}
```

Isso garante que ao reanalisar, o novo framework escolhido pela IA (respeitando as regras de bloqueio do Leandro/Deyvid) substitua o valor antigo na coluna `product`, que é o que aparece na interface.

Apenas 3 linhas precisam ser adicionadas. Após o deploy, basta reanalisar as calls do Leandro para corrigir o framework exibido.

