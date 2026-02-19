
# Correção: Análise Manual falhando para todos os Admins

## Problema Identificado

Os logs da edge function `manual-analyze` mostram dois erros recentes:

```
Insert error: { code: "22P02", message: 'invalid input syntax for type integer: "7.3"' }
Insert error: { code: "22P02", message: 'invalid input syntax for type integer: "7.7"' }
```

A coluna `score` na tabela `calls` é do tipo `integer`, mas a IA retorna valores decimais (7.3, 7.7). A edge function tenta inserir o valor bruto sem arredondar, causando falha para **todos os admins** — a análise roda, processa a transcrição, gasta tokens da OpenAI, mas **não salva o resultado**.

## O que será corrigido

### 1. Edge Function `manual-analyze/index.ts`

Linha 128, onde o score é inserido:

**Antes (com bug):**
```typescript
score: analysis.call_score || null,
```

**Depois (corrigido):**
```typescript
score: analysis.call_score != null ? Math.round(Number(analysis.call_score)) : null,
```

Isso garante que qualquer valor decimal (7.3 → 7, 7.7 → 8) seja convertido para inteiro antes de inserir no banco.

### 2. Verificação adicional de robustez

Também será adicionada a mesma proteção no campo `entry_value` e `sale_value` caso venham com formato inesperado (os campos de valor monetário são `numeric`, então não precisam de arredondamento, mas serão verificados).

## Impacto

- Todos os admins voltam a conseguir salvar análises manuais
- Nenhuma mudança no banco de dados necessária
- Correção pontual em um único arquivo
