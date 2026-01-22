-- ============================================================================
-- MIGRATION: Fase 2 - Sistema de Observabilidade e Logs
-- ============================================================================

-- 1. Tabela de logs do sistema
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')),
  service TEXT NOT NULL,
  user_id UUID,
  operation TEXT,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  stack_trace TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level) WHERE level IN ('error', 'critical');
CREATE INDEX IF NOT EXISTS idx_logs_service ON system_logs(service);
CREATE INDEX IF NOT EXISTS idx_logs_user ON system_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_logs_metadata ON system_logs USING GIN (metadata);

-- 3. View de métricas agregadas (últimas 24h)
CREATE OR REPLACE VIEW system_metrics_24h AS
SELECT
  service,
  COUNT(*) FILTER (WHERE level = 'error') as error_count,
  COUNT(*) FILTER (WHERE level = 'warning') as warning_count,
  COUNT(*) as total_operations,
  ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms,
  MAX(duration_ms) as max_duration_ms,
  ROUND(
    (COUNT(*) FILTER (WHERE level NOT IN ('error', 'critical'))::numeric /
     NULLIF(COUNT(*), 0) * 100), 2
  ) as success_rate_pct
FROM system_logs
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY service
ORDER BY error_count DESC;

-- 4. View de arquivos presos (stuck files)
CREATE OR REPLACE VIEW stuck_files_report AS
SELECT
  f.id,
  f.user_id,
  p.full_name as user_name,
  f.file_name,
  f.status::text as status,
  f.started_processing_at,
  f.retry_count,
  EXTRACT(EPOCH FROM (NOW() - f.started_processing_at))/60 as minutes_stuck,
  f.error_message
FROM imported_files f
JOIN profiles p ON p.user_id = f.user_id
WHERE f.status = 'processing'
  AND f.started_processing_at < NOW() - INTERVAL '10 minutes'
ORDER BY f.started_processing_at ASC;

-- 5. Função para logar eventos (SECURITY DEFINER para contornar RLS)
CREATE OR REPLACE FUNCTION log_event(
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
BEGIN
  INSERT INTO system_logs (
    level, service, user_id, operation,
    duration_ms, metadata, error_message
  ) VALUES (
    p_level, p_service, p_user_id, p_operation,
    p_duration_ms, p_metadata, p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 6. RLS para logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs" ON system_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Service role has full access to logs" ON system_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. Função de limpeza de logs antigos (90 dias)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM system_logs
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 8. Comentários
COMMENT ON TABLE system_logs IS 'Logs estruturados de todas as operações do sistema';
COMMENT ON FUNCTION log_event IS 'Registra evento no sistema de logs (bypassa RLS)';
COMMENT ON VIEW system_metrics_24h IS 'Métricas agregadas das últimas 24 horas';
COMMENT ON VIEW stuck_files_report IS 'Arquivos presos em processamento há mais de 10 minutos';