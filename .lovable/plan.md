

# Otimizacao Profunda - Fase 2: Requests Duplicados, select('*') Restantes e Migracao React Query

## Diagnostico Real (Evidencias dos Network Logs)

### PROBLEMA 1 - CRITICO: 3 requests duplicados de `user_roles` no load
Os logs de rede mostram **3 chamadas identicas** para `user_roles?select=role&user_id=eq.01725acd...` disparadas no **mesmo segundo** (20:02:59Z). Isso acontece porque:
- `UserRoleContext` faz 1 fetch direto via `useState/useEffect`
- `useUserPermissions` consome `useUserRole` (que le do context - OK)
- Mas `Sidebar`, `MainLayout`, e a pagina ativa **todas** montam simultaneamente e cada uma chama `useUserRole`, que por sua vez depende de `useAuth`, que dispara `getSession` + `onAuthStateChange` duplicados

A causa raiz: O `UserRoleContext` usa `useEffect` com dependencia em `[user, authLoading]`, mas o `AuthContext` atualiza `user` duas vezes (uma no `onAuthStateChange` e outra no `getSession().then()`), fazendo o role ser buscado multiplas vezes.

### PROBLEMA 2 - CRITICO: SquadView faz fetch duplicado completo
Os logs mostram a sequencia completa de `squads -> squad_members -> profiles + user_roles` sendo executada **duas vezes** (20:03:05 e 20:03:27). Isso e causado pelo `useEffect` que depende de `[user, authLoading, roleLoading, isAdmin, isLeader]` - quando `isAdmin` muda de `false` para `true` apos o role carregar, o effect re-executa.

### PROBLEMA 3 - MEDIO: `select('*')` restantes
- `ClientDetail.tsx`: `select('*')` em clients e calls (traz transcricoes completas)
- `usePortfolio.ts`: `portfolio_students.select('*')`, `ticket_upgrades.select('*')`, `student_activities.select('*')`, `indications.select('*')`
- `useIntensivoCRM.ts`: `intensive_editions.select('*')`, `intensive_leads.select('*')`

### PROBLEMA 4 - MEDIO: MonthlyGoalBar usa useState/useEffect manual
O componente `MonthlyGoalBar` faz fetch manual com `useState/useEffect` em vez de usar React Query, perdendo cache e deduplicacao.

### PROBLEMA 5 - MEDIO: DailyVerse sem cache
O componente `DailyVerse` faz fetch manual a cada montagem, quando deveria usar React Query com `staleTime` longo (o versiculo nao muda no dia).

### PROBLEMA 6 - BAIXO: Calls e Clients sem React Query
As paginas `Calls.tsx` e `Clients.tsx` ainda usam `useState/useEffect` manual, perdendo cache ao navegar entre paginas.

---

## Solucao

### Parte 1 - Eliminar fetch duplicado de user_roles no AuthContext

No `AuthContext.tsx`, o `getSession()` e `onAuthStateChange` ambos chamam `setUser`, causando 2 renderizacoes do `UserRoleContext`. Corrigir para que `getSession` so atualize se o `onAuthStateChange` ainda nao disparou:

```typescript
// AuthContext.tsx
useEffect(() => {
  let initialized = false;
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      initialized = true;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  );

  // Fallback: so usa getSession se onAuthStateChange nao disparou
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!initialized) {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

### Parte 2 - Estabilizar dependencias do useEffect no SquadView

No `SquadView.tsx`, o effect de `fetchSquadMembers` dispara quando `isAdmin` muda. Adicionar um guard para evitar re-fetch:

```typescript
const [hasFetchedMembers, setHasFetchedMembers] = useState(false);

useEffect(() => {
  if (!authLoading && !roleLoading && user && (isAdmin || isLeader) && !hasFetchedMembers) {
    setHasFetchedMembers(true);
    fetchSquadMembers();
  }
}, [user, authLoading, roleLoading, isAdmin, isLeader, hasFetchedMembers]);
```

### Parte 3 - Otimizar selects restantes

**ClientDetail.tsx**: Trocar `select('*')` por colunas especificas:
- `clients`: select com todas as colunas do Client type (excluir campos que nao existem)
- `calls`: excluir `transcription` da lista, buscar apenas quando necessario para a call selecionada

**usePortfolio.ts**: 
- `portfolio_students`: `select('id, client_id, closer_id, name, phone, email, niche, notes, current_ticket, entry_date, created_at, updated_at')`
- `ticket_upgrades`: `select('id, student_id, from_ticket, to_ticket, upgrade_date, sale_value, entry_value, notes, created_at')`
- `student_activities`: `select('id, student_id, activity_type, activity_date, notes, created_at')`
- `indications` (student): `select('id, student_id, client_id, indication_type, status, name, phone, notes, created_at')`

**useIntensivoCRM.ts**:
- `intensive_editions`: tabela pequena, `select('*')` OK
- `intensive_leads`: `select('*')` OK (sem campos de transcricao)

### Parte 4 - Migrar MonthlyGoalBar para React Query

Trocar o `useState/useEffect/fetchGoal` manual por `useQuery`:

```typescript
const { data: goalValue } = useQuery({
  queryKey: ['monthly-goal', user?.id, isAdmin],
  queryFn: async () => { /* mesma logica do fetchGoal */ },
  staleTime: 60_000,
  enabled: !!user,
});
```

### Parte 5 - Migrar DailyVerse para React Query

```typescript
const { data: verse } = useQuery({
  queryKey: ['daily-verse', user?.id],
  queryFn: async () => { /* mesma logica */ },
  staleTime: 24 * 60 * 60 * 1000, // 24h - nao muda no dia
  enabled: !!user,
});
```

### Parte 6 - Migrar Calls para React Query

Trocar `useState/useEffect/fetchCalls` manual por `useQuery` com queryKey baseada nos filtros:

```typescript
const { data: calls = [], isLoading: loading } = useQuery({
  queryKey: ['calls', targetCloserId, dateRange?.from, dateRange?.to],
  queryFn: async () => { /* mesma logica do fetchCalls */ },
  enabled: !!user && !permissionsLoading,
});
```

### Parte 7 - Migrar Clients para React Query

Mesmo padrao do Calls:

```typescript
const { data: clients = [], isLoading: loading } = useQuery({
  queryKey: ['clients', targetCloserId],
  queryFn: async () => { /* mesma logica do fetchClients */ },
  enabled: !!user && !permissionsLoading,
});
```

---

## Impacto Esperado

| Correcao | Reducao |
|----------|---------|
| Parte 1 - Auth duplicado | 66% menos requests de user_roles (3 -> 1) |
| Parte 2 - SquadView duplicado | 50% menos requests no load (sequencia inteira duplicada eliminada) |
| Parte 3 - Selects ClientDetail | ~90% menos payload na pagina de detalhe |
| Parte 4-5 - MonthlyGoal + DailyVerse | Cache persistente, zero re-fetch desnecessario |
| Parte 6-7 - Calls + Clients React Query | Navegacao instantanea entre paginas (cache) |

## Arquivos Modificados

- `src/contexts/AuthContext.tsx` (eliminar fetch duplicado)
- `src/pages/SquadView.tsx` (guard de re-fetch)
- `src/pages/ClientDetail.tsx` (selects otimizados)
- `src/hooks/usePortfolio.ts` (selects otimizados)
- `src/components/dashboard/MonthlyGoalBar.tsx` (React Query)
- `src/components/dashboard/DailyVerse.tsx` (React Query)
- `src/pages/Calls.tsx` (React Query)
- `src/pages/Clients.tsx` (React Query)

