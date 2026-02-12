

# Regras de Prioridade de Framework por Closer

## Resumo

Adicionar logica na edge function `analyze-call` que busca o nome do closer no banco de dados e injeta instrucoes de prioridade de framework no prompt antes de enviar para a IA.

## Regras de Negocio

| Closer | Prioridade 1 | Prioridade 2 | Prioridade 3 | Bloqueio |
|--------|-------------|-------------|-------------|----------|
| Gisele | Mentoria Julia Ottoni | (auto-detectar) | - | - |
| Tainara | Mentoria Julia Ottoni | (auto-detectar) | - | - |
| Hannah | Impl. Comercial / Impl. IA | (auto-detectar) | - | - |
| Deyvid | Elite Premium | Impl. Comercial | Impl. IA | NUNCA Mentoria Julia |
| Leandro | Elite Premium | Impl. Comercial | Impl. IA | NUNCA Mentoria Julia |

## Mudancas Tecnicas

### `supabase/functions/analyze-call/index.ts`

1. **Buscar perfil do closer**: Quando `userId` estiver presente, consultar a tabela `profiles` para obter o `full_name` do closer.

2. **Gerar bloco de prioridade**: Com base no nome do closer, gerar um texto de instrucoes adicionais para injetar no prompt. Exemplo para Gisele/Tainara:

```text
REGRA DE PRIORIDADE PARA ESTE CLOSER ({{nome}}):
- Framework PRIORITARIO: "Mentoria Julia Ottoni"
- Use este framework PRIMEIRO se houver QUALQUER evidencia compativel na transcricao
- Somente use outro framework se a transcricao claramente NAO se encaixar em Mentoria Julia Ottoni
```

Exemplo para Deyvid/Leandro:
```text
REGRA DE PRIORIDADE PARA ESTE CLOSER ({{nome}}):
- Ordem de prioridade: 1) Elite Premium  2) Impl. Comercial  3) Impl. IA
- NUNCA selecione "Mentoria Julia Ottoni" para este closer
- Se houver qualquer evidencia de Elite Premium, use esse framework
- Se nao, verifique Impl. Comercial, depois Impl. IA
```

3. **Injetar no prompt**: Concatenar o bloco de prioridade ao final do `MASTER_PROMPT` e do `MERGE_PROMPT` antes de enviar para a OpenAI. Isso se aplica tanto a analises diretas quanto chunked (merge).

4. **Sem impacto quando userId ausente**: Se nao houver userId ou o closer nao tiver regra de prioridade, o comportamento atual e mantido (auto-deteccao pura).

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/analyze-call/index.ts` | Buscar profile, gerar regras de prioridade, injetar no prompt |

