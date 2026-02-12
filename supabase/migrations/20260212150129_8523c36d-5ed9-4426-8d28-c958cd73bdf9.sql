
-- Financeiro can view all clients
CREATE POLICY "Financeiro can view all clients" 
ON public.clients FOR SELECT 
TO authenticated 
USING (public.has_role(auth.uid(), 'financeiro'));

-- Financeiro can update clients (sale_value, entry_value)
CREATE POLICY "Financeiro can update clients" 
ON public.clients FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'financeiro'))
WITH CHECK (public.has_role(auth.uid(), 'financeiro'));
