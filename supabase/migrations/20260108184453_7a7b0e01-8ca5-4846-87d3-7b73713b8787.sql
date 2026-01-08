-- 1. Adicionar 'lider' ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lider';

-- 2. Criar tabela de squads
CREATE TABLE IF NOT EXISTS public.squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

-- 3. Criar tabela de membros do squad
CREATE TABLE IF NOT EXISTS public.squad_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID REFERENCES public.squads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(squad_id, user_id)
);

ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

-- 4. RLS para squads
CREATE POLICY "Admins full access squads" ON public.squads FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Leaders view their squads" ON public.squads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = id AND user_id = auth.uid())
);

-- 5. RLS para squad_members
CREATE POLICY "Admins full access squad_members" ON public.squad_members FOR ALL USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users view their squad membership" ON public.squad_members FOR SELECT USING (
  user_id = auth.uid()
);

-- 6. Novos campos na tabela clients
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS funnel_source TEXT,
  ADD COLUMN IF NOT EXISTS sdr_name TEXT,
  ADD COLUMN IF NOT EXISTS product_offered TEXT,
  ADD COLUMN IF NOT EXISTS followup_date DATE;

-- 7. Novos campos na tabela calls
ALTER TABLE public.calls 
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS call_conclusion TEXT,
  ADD COLUMN IF NOT EXISTS observation TEXT,
  ADD COLUMN IF NOT EXISTS merged_with_call_id UUID REFERENCES public.calls(id);

-- 8. Trigger para updated_at em squads
CREATE TRIGGER update_squads_updated_at
BEFORE UPDATE ON public.squads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();