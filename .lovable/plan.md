
# Dashboard do Admin com Dados Agregados de Todos os Usuarios

## O que sera feito

Quando o usuario logado for **admin**, o Dashboard mostrara os dados compilados (soma) de **todos os closers**, em vez de filtrar apenas pelos dados do proprio admin. Para closers e lideres, o comportamento continua o mesmo (dados individuais).

## Alteracoes tecnicas

### 1. `src/pages/Dashboard.tsx`

- Importar `useUserRole` para verificar se o usuario e admin
- Na `queryFn`, condicionar o filtro `.eq('closer_id', user.id)`:
  - Se **admin**: remover o filtro `closer_id` de todas as 4 queries (calls, clients vendidos, clients com produto, repitch)
  - Se **closer/lider**: manter o filtro como esta hoje
- Atualizar a `queryKey` para incluir `isAdmin` (para separar o cache)

Exemplo da mudanca em cada query:
```typescript
const { isAdmin } = useUserRole();

// Antes:
let callsQuery = supabase.from('calls').select('*').eq('closer_id', user.id);

// Depois:
let callsQuery = supabase.from('calls').select('*');
if (!isAdmin) {
  callsQuery = callsQuery.eq('closer_id', user.id);
}
```

Mesma logica para as 4 queries: `callsQuery`, `clientsQuery`, `allClientsQuery`, `repitchClientsQuery`, e tambem o filtro de funnel em `filteredClients`.

### 2. `src/hooks/useMonthlySales.ts`

- Importar `useUserRole`
- Se admin, remover o filtro `.eq('closer_id', user.id)` para somar entry_value e sale_value de todos os closers
- Atualizar queryKey para incluir `isAdmin`

```typescript
const { isAdmin } = useUserRole();

let query = supabase.from('clients').select('entry_value, sale_value').eq('is_sold', true)...;
if (!isAdmin) {
  query = query.eq('closer_id', user.id);
}
```

### 3. `src/components/dashboard/MonthlyGoalBar.tsx`

- Importar `useUserRole`
- Se admin, buscar a soma de todas as `monthly_goals` do mes (em vez de filtrar por `closer_id`)
- Ou, alternativamente, ocultar a barra de meta individual e mostrar "Visao consolidada" para o admin

### 4. `src/components/dashboard/QuotaProgressBar.tsx`

- Se admin, a cota minima pode representar a soma de todos os closers
- O valor de `QUOTA_VALUE` pode ser multiplicado pelo numero de closers, ou simplesmente mostrar o total agregado sem meta individual

### 5. `src/components/dashboard/DashboardHeader.tsx` (ajuste visual)

- Se admin, mostrar um indicador visual tipo "Visao Geral (Admin)" no header para deixar claro que os dados sao agregados

## Resumo de arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Remover filtro `closer_id` das queries quando admin |
| `src/hooks/useMonthlySales.ts` | Remover filtro `closer_id` quando admin |
| `src/components/dashboard/MonthlyGoalBar.tsx` | Somar metas de todos closers quando admin |
| `src/components/dashboard/QuotaProgressBar.tsx` | Agregar cota de todos quando admin |
| `src/components/dashboard/DashboardHeader.tsx` | Indicador "Visao Geral" quando admin |

## Resultado

- Admin ve a soma total de calls, vendas, valores e ofertas de **todos os closers**
- Closers e lideres continuam vendo apenas seus proprios dados
- Barras de progresso (cota e meta) refletem o agregado quando admin
