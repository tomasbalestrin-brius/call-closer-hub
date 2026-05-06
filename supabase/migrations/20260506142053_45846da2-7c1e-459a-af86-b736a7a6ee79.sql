
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
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_pipeline_client_unique UNIQUE (client_id)
);

CREATE INDEX idx_sales_pipeline_closer ON public.sales_pipeline(closer_id);
CREATE INDEX idx_sales_pipeline_status ON public.sales_pipeline(status);

ALTER TABLE public.sales_pipeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Closers manage own sales pipeline"
ON public.sales_pipeline FOR ALL
USING (auth.uid() = closer_id)
WITH CHECK (auth.uid() = closer_id);

CREATE POLICY "Admins manage all sales pipeline"
ON public.sales_pipeline FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Financeiro view sales pipeline"
ON public.sales_pipeline FOR SELECT
USING (has_role(auth.uid(), 'financeiro'::user_role));

CREATE POLICY "Financeiro update sales pipeline"
ON public.sales_pipeline FOR UPDATE
USING (has_role(auth.uid(), 'financeiro'::user_role))
WITH CHECK (has_role(auth.uid(), 'financeiro'::user_role));

-- updated_at trigger
CREATE TRIGGER trg_sales_pipeline_updated_at
BEFORE UPDATE ON public.sales_pipeline
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- status_changed_at trigger
CREATE OR REPLACE FUNCTION public.update_sales_pipeline_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_pipeline_status_changed
BEFORE UPDATE ON public.sales_pipeline
FOR EACH ROW EXECUTE FUNCTION public.update_sales_pipeline_status_changed_at();

-- Trigger em clients para duplicar quando venda é realizada
CREATE OR REPLACE FUNCTION public.copy_client_to_sales_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Dispara quando is_sold muda para true OU status muda para venda_realizada
  IF (NEW.is_sold = true AND (OLD.is_sold IS DISTINCT FROM true))
     OR (NEW.status = 'venda_realizada' AND (OLD.status IS DISTINCT FROM 'venda_realizada')) THEN

    INSERT INTO public.sales_pipeline (
      client_id, closer_id, name, phone, email, company,
      product_offered, sale_value, entry_value, sold_at, status
    ) VALUES (
      NEW.id, NEW.closer_id, NEW.name, NEW.phone, NEW.email, NEW.company,
      NEW.product_offered, NEW.sale_value, NEW.entry_value,
      COALESCE(NEW.sold_at, now()), 'enviar_contrato'
    )
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_copy_client_to_sales_pipeline
AFTER UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.copy_client_to_sales_pipeline();
