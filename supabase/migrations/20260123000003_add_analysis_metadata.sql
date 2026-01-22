-- ============================================================================
-- CRITICAL FIX 3: Metadata de análise parcial
-- ============================================================================

-- 1. Adicionar coluna analysis_metadata
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS analysis_metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Criar índice GIN para queries em JSONB
CREATE INDEX IF NOT EXISTS idx_calls_analysis_metadata
ON calls USING GIN (analysis_metadata);

-- 3. Comentário
COMMENT ON COLUMN calls.analysis_metadata IS
  'Metadados da análise: is_partial_analysis, chunks_analyzed, chunks_total, confidence_level, timeout_occurred';

-- 4. View para calls com análise parcial (útil para monitoramento)
CREATE OR REPLACE VIEW partial_analysis_calls AS
SELECT
  c.id,
  c.client_name,
  c.call_date,
  c.score,
  c.analysis_metadata->>'is_partial_analysis' as is_partial,
  (c.analysis_metadata->>'chunks_analyzed')::int as chunks_analyzed,
  (c.analysis_metadata->>'chunks_total')::int as chunks_total,
  c.created_at
FROM calls c
WHERE c.analysis_metadata->>'is_partial_analysis' = 'true'
ORDER BY c.created_at DESC;

COMMENT ON VIEW partial_analysis_calls IS
  'Calls com análise parcial (timeout durante chunking)';
