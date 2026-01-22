-- ============================================================================
-- FIX: Converter views para SECURITY INVOKER (padrão seguro)
-- ============================================================================

-- Recriar view system_metrics_24h com SECURITY INVOKER explícito
DROP VIEW IF EXISTS system_metrics_24h;

CREATE VIEW system_metrics_24h 
WITH (security_invoker = on)
AS
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

-- Recriar view stuck_files_report com SECURITY INVOKER explícito
DROP VIEW IF EXISTS stuck_files_report;

CREATE VIEW stuck_files_report
WITH (security_invoker = on)
AS
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