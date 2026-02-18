
# Painel de Custos e Uso de API (exclusivo admin mestre)

## Contexto

O codigo da edge function `analyze-call` ja rastreia tokens usados via `globalThis.apiUsageStats` e tenta salvar via `supabase.rpc('log_api_cost', ...)`, porem a tabela e a funcao RPC nao existem no banco. Portanto os dados estao sendo perdidos silenciosamente.

## O que sera feito

### 1. Criar tabela `api_costs` no banco

Armazena cada chamada de API com:
- `user_id`, `service` (openai), `model` (gpt-4o, gpt-4o-mini)
- `operation` (direct-analysis, analyze-chunk-1, merge-analysis, etc.)
- `tokens_input`, `tokens_output`
- `call_id`, `file_id` (referencia opcional)
- `estimated_cost_usd` (calculado automaticamente)
- `created_at`

RLS: apenas admins podem visualizar (SELECT). Insert via service role (RPC com SECURITY DEFINER).

### 2. Criar funcao RPC `log_api_cost`

Recebe os parametros da edge function e insere na tabela `api_costs`, calculando o custo estimado em USD baseado no modelo:
- gpt-4o: input $2.50/1M, output $10.00/1M
- gpt-4o-mini: input $0.15/1M, output $0.60/1M

### 3. Criar componente `CostDashboard`

Exibido apenas para `tomasbalestrin@gmail.com`. Mostrara:

- **Cards de resumo**: Custo total do mes, total de tokens, numero de analises, custo medio por call
- **Tabela por modelo**: gpt-4o vs gpt-4o-mini, tokens e custos separados
- **Grafico de custos diarios** (ultimos 30 dias) usando Recharts
- **Top 5 closers por custo** no mes
- Filtro por periodo (7d, 30d, 90d)

### 4. Adicionar aba "Custos" no Admin.tsx

Nova aba visivel apenas quando `user?.email === 'tomasbalestrin@gmail.com'`, com icone `DollarSign`.

## Detalhes tecnicos

| Recurso | Arquivo/Local |
|---------|---------------|
| Tabela + RPC | Migration SQL |
| Componente | `src/components/admin/CostDashboard.tsx` (novo) |
| Integracao | `src/pages/Admin.tsx` (nova aba condicional) |

### Precos por modelo (embutidos no calculo)

```text
gpt-4o:      $2.50 / 1M input,  $10.00 / 1M output
gpt-4o-mini: $0.15 / 1M input,  $0.60  / 1M output
```

### Calculo de custo na RPC

```sql
estimated_cost_usd = 
  CASE model
    WHEN 'gpt-4o' THEN (tokens_input * 2.5 + tokens_output * 10.0) / 1000000
    WHEN 'gpt-4o-mini' THEN (tokens_input * 0.15 + tokens_output * 0.6) / 1000000
    ELSE (tokens_input * 1.0 + tokens_output * 3.0) / 1000000
  END
```

### Visibilidade restrita

A aba so aparece no Admin quando:
```typescript
const isMasterAdmin = user?.email === 'tomasbalestrin@gmail.com';
```

Nao depende de role, depende exclusivamente do email.
