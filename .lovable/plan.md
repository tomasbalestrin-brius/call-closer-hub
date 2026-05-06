## Plano: Novo módulo "CRM Vendas"

### Objetivo
Criar uma nova página kanban dedicada ao pós-venda, com 7 colunas, alimentada automaticamente quando um cliente chega em "Venda Realizada" no CRM Calls. A duplicação preserva o cartão original.

### Colunas (na ordem)
1. Enviar Contrato (`enviar_contrato`)
2. Contrato Enviado (`contrato_enviado`)
3. Contrato Assinado (`contrato_assinado`)
4. Valor Alto para Receber (`valor_alto_receber`)
5. Pedindo Indicação (`pedindo_indicacao`)
6. Rede (`rede`)
7. Venda Realizada (`venda_finalizada`)

### Banco de dados
**Nova tabela `sales_pipeline`** (separada de `clients` para não poluir o kanban de calls):

```sql
CREATE TABLE public.sales_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  closer_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  company text,
  product_offered text,
  sale_value numeric,
  entry_value numeric,
  sold_at timestamptz,
  status text NOT NULL DEFAULT 'enviar_contrato',
  notes text,
  status_changed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (client_id)  -- evita duplicação
);
```

**RLS**:
- Closer vê/edita os próprios (`closer_id = auth.uid()`)
- Admin: gerencia todos
- Financeiro: select/update todos

**Trigger** em `clients` (AFTER UPDATE OF is_sold/status):
- Quando `is_sold` muda para `true` OU `status` muda para `venda_realizada` → INSERT em `sales_pipeline` (idempotente via UNIQUE).

**Trigger** de `status_changed_at` e `updated_at` na nova tabela.

### Frontend

**Nova rota** `/sales-crm` (lazy) em `App.tsx`.

**Sidebar** (`src/components/layout/Sidebar.tsx`): adicionar item "CRM Vendas" abaixo de "CRM Calls" — visível para closer, admin e financeiro (oculto para `intensivo` e `lider` puro).

**Página `src/pages/SalesCRM.tsx`**: layout análogo ao `Clients.tsx` com header e kanban.

**Componente `src/components/sales/SalesKanban.tsx`**:
- 7 colunas com ícones/cores próprias
- Drag & drop entre colunas (atualiza `status` em `sales_pipeline`)
- Card simples mostrando: nome, valor da venda, produto, telefone

**Hook `src/hooks/useSalesPipeline.ts`**: query + realtime de `sales_pipeline` filtrando por role (admin/financeiro veem todos; closer vê só os seus).

### Casos de borda
- **Re-duplicação**: bloqueada pelo `UNIQUE(client_id)`.
- **Closer original deletado**: cascade não é aplicável (referência por uuid; mantém histórico).
- **Cliente deletado em `clients`**: `ON DELETE CASCADE` remove do pipeline.
- **Admin/Financeiro**: filtro padrão "Todos os closers"; podem filtrar por closer.

### Arquivos
| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Tabela + RLS + 2 triggers |
| `src/App.tsx` | Lazy route `/sales-crm` |
| `src/components/layout/Sidebar.tsx` | Item "CRM Vendas" |
| `src/pages/SalesCRM.tsx` | Nova página |
| `src/components/sales/SalesKanban.tsx` | Kanban 7 colunas |
| `src/components/sales/SalesCard.tsx` | Card simples |
| `src/hooks/useSalesPipeline.ts` | Fetch + realtime |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |
