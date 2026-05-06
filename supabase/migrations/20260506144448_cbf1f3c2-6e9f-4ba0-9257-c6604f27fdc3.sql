
-- 1) Ajustar RLS: closer somente SELECT
DROP POLICY IF EXISTS "Closers manage own sales pipeline" ON public.sales_pipeline;

CREATE POLICY "Closers view own sales pipeline"
ON public.sales_pipeline
FOR SELECT
USING (auth.uid() = closer_id);

-- Financeiro: garantir DELETE também (já tem update/select)
DROP POLICY IF EXISTS "Financeiro delete sales pipeline" ON public.sales_pipeline;
CREATE POLICY "Financeiro delete sales pipeline"
ON public.sales_pipeline
FOR DELETE
USING (has_role(auth.uid(), 'financeiro'::user_role));

DROP POLICY IF EXISTS "Financeiro insert sales pipeline" ON public.sales_pipeline;
CREATE POLICY "Financeiro insert sales pipeline"
ON public.sales_pipeline
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'financeiro'::user_role));

-- 2) Backfill: copiar todos os clientes de venda_realizada / is_sold para sales_pipeline
INSERT INTO public.sales_pipeline (
  client_id, closer_id, name, phone, email, company,
  product_offered, sale_value, entry_value, sold_at, status
)
SELECT
  c.id, c.closer_id, c.name, c.phone, c.email, c.company,
  c.product_offered, c.sale_value, c.entry_value,
  COALESCE(c.sold_at, now()), 'enviar_contrato'
FROM public.clients c
WHERE (c.status = 'venda_realizada' OR c.is_sold = true)
ON CONFLICT (client_id) DO NOTHING;
