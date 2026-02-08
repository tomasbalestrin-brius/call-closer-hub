

# Otimizacao Fase 3 - Ultimos Gargalos

## Problemas Restantes

### 1. SquadView sem React Query (ALTO IMPACTO)
A pagina SquadView ainda usa `useState/useEffect` manual para `fetchSquadMembers` e `fetchCloserData`. Ao navegar para outra pagina e voltar, tudo e recarregado do zero. Migrando para React Query, os dados ficam em cache por 30s e a navegacao de volta e instantanea.

### 2. fetchClosers duplicado em Calls e Clients (MEDIO)
Ambas as paginas `Calls.tsx` e `Clients.tsx` tem funcoes `fetchClosers` identicas usando `useEffect` manual. Isso deve ser extraido para um hook compartilhado com React Query, eliminando codigo duplicado e adicionando cache.

### 3. UserRoleContext potencial re-fetch (BAIXO)
O `useEffect` em `UserRoleContext` depende de `[user, authLoading]`. Se a referencia do objeto `user` mudar (mesmo sendo o mesmo usuario), o role e buscado novamente. Adicionar guard com `userId` para evitar.

---

## Solucao

### Parte 1 - Migrar SquadView para React Query

Trocar `fetchSquadMembers` por `useQuery`:

```typescript
const { data: squadMembers = [], isLoading: loadingMembers } = useQuery({
  queryKey: ['squad-members', user?.id, isAdmin, isLeader],
  queryFn: async () => { /* mesma logica */ },
  enabled: !!user && !roleLoading && (isAdmin || isLeader),
  staleTime: 60_000,
});
```

Trocar `fetchCloserData` por `useQuery`:

```typescript
const { data: closerData, isLoading: loadingCalls } = useQuery({
  queryKey: ['closer-data', selectedCloserId, dateRange.from, dateRange.to],
  queryFn: async () => { /* retorna { stats, calls } */ },
  enabled: !!selectedCloserId,
});
```

Isso elimina os `useState` de `squadMembers`, `closerStats`, `closerCalls`, `loading`, `loadingCalls`, e os `useEffect` correspondentes. Tambem elimina o `hasFetchedMembers` guard que nao sera mais necessario.

### Parte 2 - Criar hook useClosersList compartilhado

Extrair a logica de `fetchClosers` para `src/hooks/useClosersList.ts`:

```typescript
export function useClosersList() {
  const { user } = useAuth();
  const { isAdmin, isLeader, loading } = useUserPermissions();

  return useQuery({
    queryKey: ['closers-list', user?.id, isAdmin, isLeader],
    queryFn: async () => { /* busca closers conforme role */ },
    enabled: !!user && !loading && (isAdmin || isLeader),
    staleTime: 120_000, // 2min - lista de closers muda raramente
  });
}
```

Usar em `Calls.tsx` e `Clients.tsx`, removendo o `useState` de `closers` e o `useEffect` de `fetchClosers`.

### Parte 3 - Estabilizar UserRoleContext

Adicionar comparacao por `user.id` em vez de referencia do objeto `user`:

```typescript
const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);

useEffect(() => {
  if (authLoading) return;
  if (user && user.id !== lastFetchedUserId) {
    setLastFetchedUserId(user.id);
    fetchRole();
  } else if (!user) {
    setLastFetchedUserId(null);
    setRole(null);
    setIsAdmin(false);
    setIsLeader(false);
    setLoading(false);
  }
}, [user?.id, authLoading]);
```

---

## Impacto Esperado

| Correcao | Beneficio |
|----------|-----------|
| SquadView React Query | Navegacao instantanea ao voltar, cache de 60s |
| useClosersList hook | Elimina codigo duplicado, cache de 2min compartilhado entre Calls e Clients |
| UserRoleContext guard | Elimina fetch extra de user_roles em troca de auth state |

## Arquivos Modificados

- `src/pages/SquadView.tsx` (migrar para React Query)
- `src/hooks/useClosersList.ts` (novo hook compartilhado)
- `src/pages/Calls.tsx` (usar useClosersList)
- `src/pages/Clients.tsx` (usar useClosersList)
- `src/contexts/UserRoleContext.tsx` (guard por user.id)

