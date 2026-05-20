## Objetivo
Quando um card chega na coluna **"Venda Realizada"** (`venda_finalizada`) do Kanban de CRM Vendas (`sales_pipeline`), disparar webhook para `https://cs.bethelapps.com/api/webhooks/in/bethelcloser` criando o card no outro sistema. Só dispara para produto **Elite**. Cadastro/gestão via painel admin.

---

## 1. Banco de dados (migration)

- Adicionar coluna em `sales_pipeline`:
  - `webhook_sent_at timestamptz` — evita disparo duplicado se o card sair e voltar à coluna.
- Adicionar novo `event_type` suportado em `webhook_configs`: `pipeline_sale_finalized` (apenas convenção textual, sem mudança de schema).
- Inserir registro inicial via `supabase--insert`:
  - `name`: "Bethel Apps - Pipeline Finalizado"
  - `url`: `https://cs.bethelapps.com/api/webhooks/in/bethelcloser`
  - `event_type`: `pipeline_sale_finalized`
  - `product_filter`: `{elite}`
  - `is_active`: true

## 2. Nova edge function `send-pipeline-sale-webhook`
Espelho de `send-sale-webhook`, com diferenças:
- Recebe `{ pipeline_card_id }`.
- Busca o card em `sales_pipeline`, junta `clients` (dados completos) + `profiles` (closer_name) + última `calls.transcription`.
- Filtra webhooks por `event_type = 'pipeline_sale_finalized'` e `is_active = true`.
- Aplica `product_filter` (case-insensitive contains) sobre `product_offered` — só dispara para Elite.
- Após sucesso, atualiza `sales_pipeline.webhook_sent_at = now()`.
- Idempotência: se `webhook_sent_at` já estiver preenchido, retorna 200 sem reenviar.
- Registrar em `supabase/config.toml`: `[functions.send-pipeline-sale-webhook] verify_jwt = false`.

Payload enviado:
```json
{
  "event": "pipeline_sale_finalized",
  "timestamp": "...",
  "client": { "id","name","email","phone","company","niche","instagram","source",
              "sdr_name","funnel_source","has_partner","main_pain","main_difficulty","product_offered" },
  "sale":   { "sale_value","entry_value","sold_at","contract_validity","sale_notes","notes" },
  "closer_name": "...",
  "transcription": "..."
}
```

## 3. Disparo no frontend
Em `src/hooks/useSalesPipeline.ts`, dentro de `moveCard.mutationFn` após o `update` bem-sucedido:
- Se `newStatus === 'venda_finalizada'`, chamar `supabase.functions.invoke('send-pipeline-sale-webhook', { body: { pipeline_card_id: id } })` em fire-and-forget (`.catch(console.warn)`), sem bloquear UI — mesmo padrão usado em `SaleFormDialog`.

## 4. Painel admin de webhooks
Nova rota/aba dentro de `src/pages/Admin.tsx` (ou novo componente `src/components/admin/WebhooksPanel.tsx`):
- Lista todos os `webhook_configs` (nome, URL, event_type, produtos, ativo).
- Botão **Novo webhook** → dialog com:
  - `name` (texto)
  - `url` (texto)
  - `event_type` (select: `sale_closed` | `pipeline_sale_finalized`)
  - `product_filter` (multi-tag: lista livre, vazio = todos)
  - `is_active` (switch)
  - `headers` (JSON opcional, avançado)
- Editar / Deletar inline.
- Botão **Testar** que invoca a edge function correspondente com um payload de exemplo (opcional, fase 2 se quiser deixar simples agora).
- Acesso restrito a admin (já garantido pelo RLS `Admins can manage webhook configs`).

## 5. Comportamento da venda
Não alteramos `send-sale-webhook` (continua disparando no `SaleFormDialog`). O novo webhook é independente — quando o card vai pra Venda Realizada no Kanban, o outro sistema recebe a criação do card. Se você quiser desativar o webhook antigo depois, basta marcar `is_active = false` pelo painel.

---

## Arquivos afetados
- **migration**: `ALTER TABLE sales_pipeline ADD COLUMN webhook_sent_at timestamptz;`
- **insert**: novo registro em `webhook_configs`.
- **novo**: `supabase/functions/send-pipeline-sale-webhook/index.ts`
- **edit**: `supabase/config.toml` (registrar a function)
- **edit**: `src/hooks/useSalesPipeline.ts` (disparo fire-and-forget)
- **novo**: `src/components/admin/WebhooksPanel.tsx` (CRUD de webhooks)
- **edit**: `src/pages/Admin.tsx` (nova aba "Webhooks")