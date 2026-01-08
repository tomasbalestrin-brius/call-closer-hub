-- Criar função is_squad_leader
CREATE OR REPLACE FUNCTION public.is_squad_leader(_user_id uuid, _squad_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.squad_members sm
    JOIN public.user_roles ur ON ur.user_id = sm.user_id
    WHERE sm.squad_id = _squad_id
      AND sm.user_id = _user_id
      AND ur.role = 'lider'
  )
$$;

-- RLS para líderes gerenciarem membros do squad
CREATE POLICY "Leaders manage squad members" ON public.squad_members FOR ALL USING (
  is_squad_leader(auth.uid(), squad_id)
);