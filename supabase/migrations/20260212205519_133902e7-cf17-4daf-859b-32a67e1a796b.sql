CREATE POLICY "Admins can delete logs"
ON public.system_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));