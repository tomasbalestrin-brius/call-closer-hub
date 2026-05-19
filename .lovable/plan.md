## Melhorias no CRM Vendas

Aplicar as três melhorias sugeridas para admin/financeiro/closer.

### 1. Filtro por closer (admin/financeiro)
- No header do `SalesKanban`, adicionar `<Select>` "Todos os closers" + lista (reaproveitar `useClosersList`).
- Visível só para `isAdmin || isFinanceiro`.
- Filtrar `cards` por `closer_id` antes da busca por texto.

### 2. Badge com nome do closer no card
- Em `useSalesPipeline`, fazer join leve: buscar `profiles (user_id, full_name)` dos closers presentes e mapear `closer_name` em cada card.
- No card, exibir `<Badge variant="secondary">` com o nome do closer (apenas quando admin/financeiro — closer não precisa ver o próprio nome).

### 3. Permitir closer mover seus próprios cards
- Adicionar policy RLS `UPDATE` em `sales_pipeline`: `closer_id = auth.uid()` (using + with check).
- Frontend: trocar `canEdit` por `canEditCard(card)` = admin/financeiro OU `card.closer_id === user.id`.
- `draggable`, drop, bulk move e delete passam a respeitar essa regra por card.
- Delete continua restrito a admin/financeiro.

### Arquivos
| Arquivo | Mudança |
|---|---|
| Migração SQL | Nova policy UPDATE para closer dono |
| `src/hooks/useSalesPipeline.ts` | Join com profiles → `closer_name` |
| `src/components/sales/SalesKanban.tsx` | Filtro closer, badge, permissão por card |

### Casos de borda
- Closer continua **sem** ver cards de outros (RLS SELECT já bloqueia).
- Bulk move do closer só afeta os próprios (RLS UPDATE filtra).
- Filtro por closer some quando o usuário é closer puro.
