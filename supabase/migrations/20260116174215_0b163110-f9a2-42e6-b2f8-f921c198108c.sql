-- Líderes podem visualizar perfis dos membros do seu squad
CREATE POLICY "Leaders can view squad member profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'lider') 
  AND EXISTS (
    SELECT 1 FROM squad_members sm1
    JOIN squad_members sm2 ON sm1.squad_id = sm2.squad_id
    WHERE sm1.user_id = auth.uid() 
    AND sm2.user_id = profiles.user_id
  )
);

-- Líderes podem atualizar perfis dos membros do squad
CREATE POLICY "Leaders can update squad member profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'lider') 
  AND EXISTS (
    SELECT 1 FROM squad_members sm1
    JOIN squad_members sm2 ON sm1.squad_id = sm2.squad_id
    WHERE sm1.user_id = auth.uid() 
    AND sm2.user_id = profiles.user_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'lider') 
  AND EXISTS (
    SELECT 1 FROM squad_members sm1
    JOIN squad_members sm2 ON sm1.squad_id = sm2.squad_id
    WHERE sm1.user_id = auth.uid() 
    AND sm2.user_id = profiles.user_id
  )
);

-- Líderes podem inserir novos perfis (para criar closers)
CREATE POLICY "Leaders can insert profiles"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'lider'));