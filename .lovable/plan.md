

# Mostrar tamanho da call nas rejeicoes por qualidade

## O que muda

Na tabela "Calls Rejeitadas por Qualidade" do painel de Logs de Erros, ao lado do badge "Call muito curta", sera exibido o tamanho do conteudo da call (em caracteres) que ja esta salvo no metadata do log.

Exemplo visual: em vez de apenas `Call muito curta`, ficara `Call muito curta (282 / 3750 chars)` -- mostrando quantos caracteres a call tinha versus o minimo exigido.

## Dados disponiveis

Cada log de rejeicao ja armazena no campo `metadata`:
- `content_length`: tamanho real do conteudo (ex: 282)
- `minimum_length`: tamanho minimo exigido (ex: 3750)

Nao e necessaria nenhuma alteracao no backend.

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/admin/ErrorLogsPanel.tsx` | Extrair `content_length` e `minimum_length` do metadata e exibir ao lado do badge de motivo na coluna "Motivo" |

Na coluna "Motivo" da tabela de rejeicoes, o codigo atual mostra apenas o badge com texto. Sera adicionado um texto auxiliar com o tamanho:

```
Call muito curta (282 / 3750)
```

Funcoes auxiliares `getMetadataContentLength` e `getMetadataMinLength` serao adicionadas seguindo o mesmo padrao das funcoes `getMetadataFileName`, `getMetadataReason` etc. que ja existem no componente.

