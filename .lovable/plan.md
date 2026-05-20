## O que vai mudar

### 1. Mostrar faturamento no card da Call (em todos os locais que renderizam o card)

Hoje o `CallCard.tsx` só mostra `call.sale_value`. Quando você registra a venda pelo **CRM Vendas** (kanban) ou pelo SaleFormDialog do cliente, o valor entra em `clients.sale_value` — e o card da call (que vive em outra tabela) continua sem nada.

**Solução:**
- No `CallCard`, exibir o valor priorizando `call.sale_value`; se vazio e existir `client_id`, buscar `clients.sale_value` / `entry_value` do cliente vinculado e exibir.
- Centralizar o fetch em `useCalls` (ou hook semelhante já existente) para não disparar uma query por card — fazer um único `SELECT id, sale_value, entry_value FROM clients WHERE id IN (...)` e injetar `clientSaleValue` no objeto da call passado ao componente.
- Adicionar um badge discreto no **canto superior direito** do card (`absolute top-2 right-2` dentro do CardContent, ou logo abaixo dos badges de status) com ícone `DollarSign` + valor formatado em BRL, cor `success`. Aparece em qualquer tela que renderize o `CallCard` (Calls, SquadView, etc.).

### 2. Botão "Marcar como Vendida" no menu da call

**Solução:**
- Em `CallCardMenu.tsx`, adicionar item de menu **"Marcar como Vendida"** (ícone `DollarSign`, visível quando `call.status !== 'vendido'`).
- Ao clicar, abrir um novo `MarkAsSoldDialog` simples com 2 campos: **Valor da Venda** e **Valor de Entrada** (ambos opcionais), botão **Confirmar**.
- Ao confirmar:
  1. `UPDATE calls SET status='vendido', sale_value=?, entry_value=? WHERE id=?`
  2. Se `call.client_id` existir: `UPDATE clients SET is_sold=true, sold_at=now(), sale_value=?, entry_value=?, status='venda_realizada' WHERE id=?` (mesma lógica do `SaleFormDialog`).
  3. Disparar o webhook existente `send-sale-webhook` (fire-and-forget) se houver `client_id`.
  4. Chamar `onCallUpdated()` para refrescar a lista e mover o card para o filtro **Vendidas**.
- Se já estiver vendida, o item de menu vira **"Editar venda"** com os valores preenchidos.

### Arquivos afetados

- `src/components/calls/CallCard.tsx` — exibir valor no canto, fallback para sale_value do client vinculado.
- `src/components/calls/CallCardMenu.tsx` — novo item de menu "Marcar como Vendida".
- `src/components/calls/MarkAsSoldDialog.tsx` *(novo)* — diálogo simples com valor da venda/entrada.
- `src/hooks/useCalls.ts` (ou onde a lista de calls é buscada) — enriquecer com `clientSaleValue`/`clientEntryValue` via batch query.

### Não muda
- RLS, edge functions e schema — closers já podem fazer UPDATE em calls e clients próprios.
- O fluxo do CRM Vendas (kanban) e do `SaleFormDialog` continua intacto.
