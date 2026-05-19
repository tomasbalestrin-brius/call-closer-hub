CREATE POLICY "Closers update own sales pipeline"
ON public.sales_pipeline
FOR UPDATE
TO authenticated
USING (auth.uid() = closer_id)
WITH CHECK (auth.uid() = closer_id);