

# Corrigir race condition na Meta Mensal do admin

## Problema

O hook `useDashboardData` e a query de stats no Dashboard disparam ANTES do papel do usuario (admin/closer/lider) ser carregado. Como `isAdmin` comeca como `false`, a primeira query roda filtrando por `closer_id = user.id`, trazendo dados individuais em vez do agregado de todos os closers.

Quando o papel finalmente carrega e `isAdmin` vira `true`, a query key muda e o refetch acontece, mas o `placeholderData` mantem os dados errados visiveis ate o novo resultado chegar -- ou em alguns casos o usuario ja viu os valores errados.

## Solucao

Adicionar a verificacao de `loading` do `useUserRole()` na condicao `enabled` de todas as queries que dependem de `isAdmin`.

---

## Mudancas

### 1. `src/hooks/useDashboardData.ts`

- Desestruturar `loading: roleLoading` de `useUserRole()`
- Alterar `enabled` de `!!user` para `!!user && !roleLoading`
- Isso garante que a query so dispara depois que o papel do usuario esta determinado

### 2. `src/pages/Dashboard.tsx`

- O hook `useUserRole()` ja e chamado na linha 8 como `const { isAdmin } = useUserRole()`
- Adicionar `loading: roleLoading` na desestruturacao
- Alterar o `enabled` da query de stats (linha ~45) de `!!user` para `!!user && !roleLoading`

---

## Detalhes tecnicos

Antes (useDashboardData.ts):
```text
const { isAdmin } = useUserRole();
// ...
enabled: !!user,
```

Depois:
```text
const { isAdmin, loading: roleLoading } = useUserRole();
// ...
enabled: !!user && !roleLoading,
```

O mesmo padrao se aplica a query de stats no Dashboard.tsx.

Com essa mudanca, nenhuma query sera executada ate que `isAdmin` tenha seu valor correto, eliminando os dados errados na tela.

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useDashboardData.ts` | Adicionar roleLoading ao enabled |
| `src/pages/Dashboard.tsx` | Adicionar roleLoading ao enabled da query de stats |

