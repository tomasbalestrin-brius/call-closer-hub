
-- Table to store webhook configurations
CREATE TABLE public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'sale_closed',
  is_active BOOLEAN NOT NULL DEFAULT true,
  headers JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

-- Only admins can manage webhook configs
CREATE POLICY "Admins can manage webhook configs"
  ON public.webhook_configs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_webhook_configs_updated_at
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the default webhook config
INSERT INTO public.webhook_configs (name, url, event_type, is_active)
VALUES ('Bethel Apps - Vendas', 'https://cs.bethelapps.com/api/webhooks/in/bethelcloser', 'sale_closed', true);
