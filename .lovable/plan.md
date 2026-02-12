
# Adicionar Role "Financeiro" ao Sistema

## Resumo

Criar um novo papel de usuario "financeiro" que tera acesso a todos os dados (como o admin) e permissao especifica para visualizar, editar e excluir valores de venda (`sale_value`) e entrada (`entry_value`) nos clientes de qualquer closer.

---

## Mudancas

### 1. Migracao de banco de dados

**Adicionar valor ao enum `user_role`:**
```text
ALTER TYPE public.user_role ADD VALUE 'financeiro';
```

**Adicionar politicas RLS para financeiro na tabela `clients`:**
- SELECT: financeiro pode ver todos os clientes
- UPDATE: financeiro pode atualizar `sale_value` e `entry_value` de qualquer cliente

```text
CREATE POLICY "Financeiro can view all clients" 
ON public.clients FOR SELECT 
TO authenticated 
USING (has_role(auth.uid(), 'financeiro'));

CREATE POLICY "Financeiro can update clients" 
ON public.clients FOR UPDATE 
TO authenticated 
USING (has_role(auth.uid(), 'financeiro'))
WITH CHECK (has_role(auth.uid(), 'financeiro'));
```

### 2. `src/types/index.ts`

- Adicionar `'financeiro'` ao tipo `UserRole`

### 3. `src/contexts/UserRoleContext.tsx`

- Adicionar estado `isFinanceiro` (true quando role === 'financeiro')
- Expor `isFinanceiro` no contexto

### 4. `src/hooks/useUserRole.ts` / `src/hooks/useUserPermissions.ts`

- Expor `isFinanceiro` nos hooks
- Adicionar permissao `canEditSalesValues` (true para admin e financeiro)

### 5. `src/components/admin/UserRoleSelect.tsx`

- Adicionar opcao "Financeiro" no select de roles
- Atualizar `ROLE_LABELS` com `financeiro: 'Financeiro'`

### 6. `src/components/admin/NewCloserDialog.tsx`

- Atualizar titulo/descricao para refletir que nao e apenas closer (opcional, pode manter generico)

### 7. `src/components/layout/Sidebar.tsx`

- Financeiro tera acesso ao painel admin (lista de closers) para poder navegar e editar valores
- Adicionar `isFinanceiro` na condicao de navegacao

### 8. `src/pages/Admin.tsx`

- Permitir acesso ao financeiro (alem de admin e lider)
- Financeiro vera a lista de closers mas nao podera gerenciar roles, squads, importacoes ou excluir usuarios
- Financeiro podera ver metas e valores de vendas

### 9. `src/components/clients/SaleFormDialog.tsx`

- Atualmente qualquer usuario que acessa o dialog pode editar valores
- A protecao principal e via RLS (ja coberta pela nova policy)
- Nenhuma mudanca necessaria neste componente

### 10. `src/hooks/useDashboardData.ts` e `src/hooks/useMonthlySales.ts`

- Financeiro vera dados consolidados de todos (como admin)
- Adicionar `isFinanceiro` na condicao que remove filtro por `closer_id`

### 11. Edge Functions (`admin-reset-password`, `admin-delete-user`)

- Manter restricao apenas para admin (financeiro NAO pode resetar senhas ou excluir usuarios)

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Adicionar 'financeiro' ao enum e criar RLS policies |
| `src/types/index.ts` | Adicionar 'financeiro' ao tipo UserRole |
| `src/contexts/UserRoleContext.tsx` | Adicionar isFinanceiro ao contexto |
| `src/hooks/useUserRole.ts` | Expor isFinanceiro |
| `src/hooks/useUserPermissions.ts` | Adicionar canEditSalesValues, expor isFinanceiro |
| `src/components/admin/UserRoleSelect.tsx` | Adicionar opcao Financeiro |
| `src/components/layout/Sidebar.tsx` | Permitir navegacao admin para financeiro |
| `src/pages/Admin.tsx` | Permitir acesso financeiro com permissoes limitadas |
| `src/hooks/useDashboardData.ts` | Financeiro ve dados de todos |
| `src/hooks/useMonthlySales.ts` | Financeiro ve dados de todos |
| `src/components/dashboard/SalesListDialog.tsx` | Financeiro ve todas as vendas |

