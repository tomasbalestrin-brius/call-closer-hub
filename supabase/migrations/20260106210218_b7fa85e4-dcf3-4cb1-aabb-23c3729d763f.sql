-- Adicionar campos de venda na tabela clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_sold boolean DEFAULT false;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sold_at timestamp with time zone;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sale_value numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS entry_value numeric;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS negotiation_notes text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contract_validity text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS sale_notes text;

-- Criar função para inserir notificações de follow-up (SECURITY DEFINER para bypass RLS)
CREATE OR REPLACE FUNCTION public.create_followup_notification(
  p_user_id uuid,
  p_title text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (p_user_id, p_title, p_message, 'followup');
END;
$$;