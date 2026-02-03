
# Plano: Corrigir max_tokens para gpt-4o-mini

## Problema Crítico Identificado

A importação de calls está **100% falhando** (13 erros, 0 sucesso) porque o código está pedindo 24.000 tokens, mas o modelo `gpt-4o-mini` suporta no máximo **16.384 tokens**.

**Mensagem de erro:**
```
max_tokens is too large: 24000. This model supports at most 16384 completion tokens
```

## Arquivos com Erro

| Arquivo | Erro |
|---------|------|
| mcx-wqbi-ktp | max_tokens muito grande |
| jdq-tidu-fia | max_tokens muito grande |
| nhx-heiv-utt | OpenAI API error: 400 |
| cxv-jnvz-eix | OpenAI API error: 400 |
| rgb-cqqg-sgb | OpenAI API error: 400 |
| mkj-drmq-aqu | OpenAI API error: 400 |
| vyb-hpno-kvh | OpenAI API error: 400 |
| kvo-wuhm-kue | OpenAI API error: 400 |
| afy-jxyc-pmh | OpenAI API error: 400 |
| jak-nrvo-viu | OpenAI API error: 400 |
| nrw-jkqy-crf | OpenAI API error: 400 |
| yiv-jqny-fci | Call curta (filtro válido) |
| cbk-gdtd-wey | Call curta (filtro válido) |

## Correção Proposta

### Arquivo: `supabase/functions/analyze-call/index.ts`

**Alteração 1** - Linha 1262 (função `mergeChunkAnalyses`):
```typescript
// De:
max_tokens: 24000, // Increased for large merged analyses

// Para:
max_tokens: 16000, // Maximum supported by gpt-4o-mini
```

**Alteração 2** - Linha 1627 (função `repairJSONWithAI`):
```typescript
// De:
max_tokens: 24000,

// Para:
max_tokens: 16000, // Maximum supported by gpt-4o-mini
```

## Resultado Esperado

Após a correção:
- A análise com IA funcionará corretamente
- Os 11 arquivos com erro serão reprocessados com sucesso
- O sync automático voltará a funcionar

## Passos Após Aprovação

1. Aplicar as alterações no código
2. Fazer deploy da edge function `analyze-call`
3. Resetar os arquivos com erro para "pending"
4. Reprocessar os arquivos

## Seção Técnica

### Limites do Modelo gpt-4o-mini

| Propriedade | Valor |
|-------------|-------|
| Context window | 128K tokens |
| Max output tokens | 16.384 tokens |

### Linhas Afetadas

```text
Linha 1262: max_tokens: 24000, // Increased for large merged analyses
Linha 1627: max_tokens: 24000,
```

### Impacto

As análises muito longas podem ficar ligeiramente truncadas (16K vs 24K tokens), mas isso é preferível a 100% de falha. Na prática, a maioria das análises fica abaixo de 12K tokens.
