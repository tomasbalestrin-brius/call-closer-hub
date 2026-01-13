-- Remove a política que permite closers deletarem suas próprias calls
DROP POLICY IF EXISTS "Closers can delete their own calls" ON public.calls;

-- Admins podem deletar qualquer call
CREATE POLICY "Admins can delete any call"
ON public.calls FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Líderes podem deletar calls de membros do seu squad (incluindo suas próprias)
CREATE POLICY "Leaders can delete squad member calls"
ON public.calls FOR DELETE
TO authenticated
USING (is_squad_leader_of_user(auth.uid(), closer_id));