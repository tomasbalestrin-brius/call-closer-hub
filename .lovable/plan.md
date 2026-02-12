

# Corrigir vendas zeradas no dialog "Vendas Fechadas"

## Problema

O dialog "Vendas Fechadas" mostra 0 vendas porque a query e executada antes do papel do usuario (admin/closer) ser carregado. Quando o dialog abre, `isAdmin` ainda esta `false`, entao a query filtra por `closer_id` do admin -- que nao tem vendas proprias.

O card do Dashboard funciona corretamente porque sua query usa `enabled: !!user && !roleLoading`, mas o `SalesListDialog` usa apenas `enabled: open && !!user`, ignorando o estado de carregamento do papel.

## Solucao

### `src/components/dashboard/SalesListDialog.tsx`

1. Importar `loading` do hook `useUserRole`
2. Adicionar `!loading` na condicao `enabled` da query
3. Adicionar `loading` no `queryKey` para forcar refetch apos resolucao do papel

**Antes:**
```text
const { isAdmin } = useUserRole();
// ...
enabled: open && !!user,
```

**Depois:**
```text
const { isAdmin, loading: roleLoading } = useUserRole();
// ...
enabled: open && !!user && !roleLoading,
```

## Arquivo modificado

| Arquivo | Mudanca |
|---------|---------|
| `src/components/dashboard/SalesListDialog.tsx` | Sincronizar query com resolucao do papel do usuario |

