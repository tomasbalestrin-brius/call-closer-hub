-- ============================================================================
-- MIGRATION: Sistema de Rate Limiting (Corrigido)
-- ============================================================================

-- 1. Tabela de rate limits
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('openai', 'google-drive', 'analyze-call')),
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, service, window_start)
);

-- Índices para performance (sem predicado com NOW())
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON api_rate_limits(user_id, service, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup ON api_rate_limits(window_start);

-- 2. Função para incrementar rate limit
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_user_id UUID,
  p_service TEXT,
  p_tokens BIGINT DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Janela de 1 hora, arredondada para hora cheia
  v_window_start := DATE_TRUNC('hour', NOW());

  INSERT INTO api_rate_limits (user_id, service, window_start, request_count, tokens_used)
  VALUES (p_user_id, p_service, v_window_start, 1, p_tokens)
  ON CONFLICT (user_id, service, window_start)
  DO UPDATE SET
    request_count = api_rate_limits.request_count + 1,
    tokens_used = api_rate_limits.tokens_used + p_tokens,
    updated_at = NOW();
END;
$$;

-- 3. Função para verificar rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_service TEXT,
  p_max_requests INTEGER DEFAULT 1000,
  p_max_tokens BIGINT DEFAULT 1000000
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_requests INTEGER,
  current_tokens BIGINT,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_requests INTEGER;
  v_current_tokens BIGINT;
BEGIN
  v_window_start := DATE_TRUNC('hour', NOW());

  -- Buscar uso atual na janela de 1 hora
  SELECT
    COALESCE(SUM(request_count), 0)::INTEGER,
    COALESCE(SUM(tokens_used), 0)::BIGINT
  INTO v_current_requests, v_current_tokens
  FROM api_rate_limits
  WHERE api_rate_limits.user_id = p_user_id
    AND api_rate_limits.service = p_service
    AND api_rate_limits.window_start >= v_window_start;

  RETURN QUERY SELECT
    (v_current_requests < p_max_requests AND v_current_tokens < p_max_tokens) as allowed,
    v_current_requests as current_requests,
    v_current_tokens as current_tokens,
    (v_window_start + INTERVAL '1 hour') as reset_at;
END;
$$;

-- 4. Função de limpeza automática
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_rate_limits
  WHERE window_start < NOW() - INTERVAL '2 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 5. RLS
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits" ON api_rate_limits
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role has full access to rate limits" ON api_rate_limits
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Comentários
COMMENT ON TABLE api_rate_limits IS 'Rate limiting por usuário e serviço';
COMMENT ON FUNCTION check_rate_limit IS 'Verifica se usuário está dentro do limite';
COMMENT ON FUNCTION increment_rate_limit IS 'Incrementa contador de uso';