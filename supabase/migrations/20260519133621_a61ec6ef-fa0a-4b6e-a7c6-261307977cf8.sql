
-- Harden log_event: input validation, length caps, restrict callers
CREATE OR REPLACE FUNCTION public.log_event(
  p_level TEXT,
  p_service TEXT,
  p_user_id UUID DEFAULT NULL,
  p_operation TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_role TEXT := current_setting('request.jwt.claim.role', true);
BEGIN
  -- Restrict callers: only service role or admins may write logs directly
  IF v_role IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin'::user_role)) THEN
    RAISE EXCEPTION 'Only service role or admins can write system logs';
  END IF;

  -- Validate level
  IF p_level IS NULL OR p_level NOT IN ('debug','info','warn','error','critical') THEN
    RAISE EXCEPTION 'Invalid log level';
  END IF;

  -- Length caps to prevent log pollution
  IF p_service IS NULL OR length(p_service) > 100 THEN
    RAISE EXCEPTION 'Invalid service name';
  END IF;
  IF p_operation IS NOT NULL AND length(p_operation) > 200 THEN
    p_operation := left(p_operation, 200);
  END IF;
  IF p_error_message IS NOT NULL AND length(p_error_message) > 5000 THEN
    p_error_message := left(p_error_message, 5000);
  END IF;
  IF p_metadata IS NOT NULL AND length(p_metadata::text) > 10000 THEN
    p_metadata := jsonb_build_object('truncated', true);
  END IF;

  INSERT INTO system_logs (
    level, service, user_id, operation,
    duration_ms, metadata, error_message
  ) VALUES (
    p_level, p_service, p_user_id, p_operation,
    p_duration_ms, COALESCE(p_metadata, '{}'::jsonb), p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Revoke default execute from anon/authenticated; allow service role + admins via SECURITY DEFINER check
REVOKE EXECUTE ON FUNCTION public.log_event(TEXT,TEXT,UUID,TEXT,INTEGER,JSONB,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_event(TEXT,TEXT,UUID,TEXT,INTEGER,JSONB,TEXT) TO service_role, authenticated;
