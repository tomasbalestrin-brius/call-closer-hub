-- Create function to check if a user is a squad leader of another user
CREATE OR REPLACE FUNCTION public.is_squad_leader_of_user(_leader_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM squad_members sm_leader
    JOIN squad_members sm_user ON sm_leader.squad_id = sm_user.squad_id
    JOIN user_roles ur ON ur.user_id = sm_leader.user_id
    WHERE sm_leader.user_id = _leader_id
      AND sm_user.user_id = _user_id
      AND ur.role = 'lider'
      AND sm_leader.user_id != sm_user.user_id
  )
$$;

-- Add RLS policy for leaders to view squad member calls
CREATE POLICY "Leaders can view squad member calls"
ON public.calls FOR SELECT
TO authenticated
USING (
  is_squad_leader_of_user(auth.uid(), closer_id)
);

-- Add RLS policy for leaders to view squad member clients
CREATE POLICY "Leaders can view squad member clients"
ON public.clients FOR SELECT
TO authenticated
USING (
  is_squad_leader_of_user(auth.uid(), closer_id)
);