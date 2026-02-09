-- 1. Fix system_logs RLS: remove insecure public policy
DROP POLICY IF EXISTS "Service role has full access to logs" ON public.system_logs;