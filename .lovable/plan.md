

# Otimizacao de Carregamento e Performance do Sistema

## Problemas identificados

1. **Sem code splitting**: Todas as 14 paginas sao importadas estaticamente no App.tsx, carregando o bundle inteiro no primeiro acesso
2. **useAuth() duplicado**: Chamado independentemente em MainLayout, Sidebar, Dashboard, DashboardHeader, DailyVerse, QuotaProgressBar, MonthlyGoalBar -- cada um cria uma nova subscription do Supabase Auth
3. **useUserRole() duplicado**: Chamado separadamente em Sidebar e em cada pagina via useUserPermissions, fazendo query duplicada na tabela user_roles
4. **Queries duplicadas no Dashboard**: QuotaProgressBar e MonthlyGoalBar fazem queries separadas na tabela clients com filtros quase identicos (sold_at do mes atual)
5. **Dashboard sem React Query**: Usa useEffect manual, sem cache, sem deduplicacao -- toda troca de filtro refaz todas as queries do zero
6. **N+1 na pagina Clients**: Busca TODAS as calls para descobrir a ultima data de cada cliente, em vez de usar uma query otimizada

## Solucao

### 1. Code Splitting com React.lazy

Converter todas as rotas (exceto Index/Auth que sao as mais acessadas) para lazy loading com React.lazy + Suspense. Isso reduz o bundle inicial significativamente.

**Arquivo**: `src/App.tsx`

Trocar imports estaticos por dinamicos:
```typescript
const Calls = lazy(() => import('./pages/Calls'));
const Clients = lazy(() => import('./pages/Clients'));
const Admin = lazy(() => import('./pages/Admin'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const IntensivoCRM = lazy(() => import('./pages/IntensivoCRM'));
// ... demais paginas
```

Envolver Routes com `<Suspense fallback={<LoadingSpinner />}>`.

### 2. AuthProvider com Context (eliminar duplicacao)

Criar um `AuthProvider` que centraliza a subscription do Supabase Auth e expoe user/session via Context. Todos os componentes usam o mesmo estado, sem criar novas subscriptions.

**Novo arquivo**: `src/contexts/AuthContext.tsx`

Move a logica do useAuth para um Provider com createContext. O hook useAuth passa a consumir o context em vez de criar novas subscriptions.

**Arquivo modificado**: `src/hooks/useAuth.ts`

Refatorar para usar o Context:
```typescript
export function useAuth() {
  return useContext(AuthContext);
}
```

### 3. UserRoleProvider com Context (eliminar duplicacao)

Mesmo padrao: criar um Provider que faz a query de role UMA vez e compartilha via Context.

**Novo arquivo**: `src/contexts/UserRoleContext.tsx`

O hook useUserRole passa a consumir o context. useUserPermissions continua funcionando sem mudanca.

### 4. Unificar queries do Dashboard com React Query

Converter as queries manuais (useEffect + useState) do Dashboard para React Query, obtendo:
- Cache automatico (navegar para outra pagina e voltar = instantaneo)
- Deduplicacao (mesma query nao roda 2x ao mesmo tempo)
- staleTime de 30 segundos (evita re-fetch desnecessario)

**Arquivo modificado**: `src/pages/Dashboard.tsx`

Substituir fetchDashboardData por useQuery:
```typescript
const { data: stats, isLoading } = useQuery({
  queryKey: ['dashboard-stats', user?.id, dateRange, selectedFunnel],
  queryFn: () => fetchDashboardData(),
  staleTime: 30_000,
  enabled: !!user,
});
```

### 5. Unificar QuotaProgressBar e MonthlyGoalBar

Ambos consultam `clients` com `is_sold = true` e `sold_at` do mes atual. Criar um hook compartilhado `useMonthlySales` com React Query que faz UMA query e retorna os dados para ambos.

**Novo arquivo**: `src/hooks/useMonthlySales.ts`

```typescript
export function useMonthlySales() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['monthly-sales', user?.id],
    queryFn: async () => {
      // Uma unica query retornando entry_value e sale_value
      const { data } = await supabase
        .from('clients')
        .select('entry_value, sale_value')
        .eq('closer_id', user.id)
        .eq('is_sold', true)
        .gte('sold_at', monthStart)
        .lte('sold_at', monthEnd);
      return {
        totalEntry: sum of entry_value,
        totalSale: sum of sale_value,
      };
    },
    staleTime: 60_000,
  });
}
```

**Arquivos modificados**: `QuotaProgressBar.tsx` e `MonthlyGoalBar.tsx` passam a usar `useMonthlySales()`.

### 6. Corrigir N+1 na pagina Clients

Em vez de buscar todas as calls e filtrar no JS, usar uma subquery ou RPC que retorna apenas o `max(call_date)` por client_id.

**Arquivo modificado**: `src/pages/Clients.tsx`

Substituir a logica de fetch de lastCallDate:
```typescript
// Antes: busca TODAS as calls e filtra no JS
// Depois: query otimizada
const { data: lastCalls } = await supabase
  .from('calls')
  .select('client_id, call_date')
  .in('client_id', clientIds)
  .order('call_date', { ascending: false });

// Manter apenas a primeira ocorrencia por client_id (ja ordenado desc)
const lastCallDates: Record<string, string> = {};
lastCalls?.forEach(call => {
  if (!lastCallDates[call.client_id]) {
    lastCallDates[call.client_id] = call.call_date;
  }
});
```

Isso ja e o que o codigo faz, mas vamos adicionar `.limit()` proporcional e converter para React Query com cache.

### 7. Componente LoadingSpinner reutilizavel

Criar um componente de loading consistente para o Suspense fallback e estados de carregamento.

**Novo arquivo**: `src/components/LoadingSpinner.tsx`

---

## Resumo de arquivos

| Arquivo | Acao |
|---------|------|
| `src/App.tsx` | Code splitting com React.lazy + Suspense |
| `src/contexts/AuthContext.tsx` | Novo - AuthProvider centralizado |
| `src/contexts/UserRoleContext.tsx` | Novo - UserRoleProvider centralizado |
| `src/hooks/useAuth.ts` | Refatorar para usar Context |
| `src/hooks/useUserRole.ts` | Refatorar para usar Context |
| `src/hooks/useMonthlySales.ts` | Novo - hook compartilhado para QuotaProgressBar + MonthlyGoalBar |
| `src/components/dashboard/QuotaProgressBar.tsx` | Usar useMonthlySales |
| `src/components/dashboard/MonthlyGoalBar.tsx` | Usar useMonthlySales |
| `src/pages/Dashboard.tsx` | Converter para React Query |
| `src/pages/Clients.tsx` | Otimizar query de lastCallDate |
| `src/components/LoadingSpinner.tsx` | Novo - componente de loading |
| `src/main.tsx` | Envolver App com AuthProvider + UserRoleProvider |

## Impacto esperado

- **Bundle inicial**: reducao de ~40-50% (code splitting)
- **Queries no Dashboard**: de ~10 queries independentes para ~4 queries com cache
- **Auth subscriptions**: de 7+ simultaneas para 1 unica
- **Navegacao entre paginas**: instantanea com cache do React Query
- **Re-renders**: reducao significativa com Context centralizado

