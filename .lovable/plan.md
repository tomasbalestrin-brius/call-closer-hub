

# Filtrar "Reanalisar Todas" para apenas calls com problemas

## Problema atual

O botao "Reanalisar Todas" na aba de imports chama a edge function `batch-reanalyze` com `reanalyzeAll: true`, que busca **todas** as 163 calls que tem `technical_analysis` -- inclusive as que foram analisadas com sucesso. Isso gasta tempo e creditos da OpenAI desnecessariamente.

## Solucao

Alterar a edge function `batch-reanalyze` para filtrar apenas calls problematicas quando `reanalyzeAll: true`. As calls consideradas "com problemas" sao:

1. `analysis_metadata.timeout_occurred = true` (timeout na analise)
2. `analysis_metadata.is_partial_analysis = true` (analise parcial)
3. `analysis_metadata.confidence_level` diferente de "high" (baixa confianca)
4. `analysis_quality_score < 0.5` (qualidade baixa)
5. `analise_por_etapa` ausente no `technical_analysis` (falta dados de etapas)
6. Todas as etapas em `analise_por_etapa` com nota 0 (etapas zeradas)

Calls que nao se encaixam em nenhum desses criterios sao consideradas "bem sucedidas" e **nao serao reanalisadas**.

## Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/batch-reanalyze/index.ts` | Filtrar calls problematicas no branch `reanalyzeAll` |

### Mudanca na edge function

No branch `reanalyzeAll`, a query passara a buscar tambem `technical_analysis`, `analysis_metadata` e `analysis_quality_score`. Apos o fetch, um filtro em JavaScript identifica apenas as calls com problemas usando os criterios acima.

A mensagem de retorno tambem sera atualizada para mostrar quantas calls tinham problemas vs total.

