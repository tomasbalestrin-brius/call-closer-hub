-- Migration: Soft Delete and Backup Support
-- Description: Add soft-delete for calls and support for data export/recovery
-- Author: Claude
-- Date: 2026-01-23

-- ============= ADD SOFT DELETE COLUMNS =============

ALTER TABLE calls ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for filtering deleted calls
CREATE INDEX IF NOT EXISTS idx_calls_deleted_at ON calls(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_active ON calls(closer_id, call_date DESC) WHERE deleted_at IS NULL;

-- ============= UPDATE EXISTING VIEWS TO EXCLUDE DELETED =============

-- Recreate existing views to filter out soft-deleted calls
DROP VIEW IF EXISTS low_quality_calls CASCADE;
DROP VIEW IF EXISTS quality_by_closer CASCADE;
DROP VIEW IF EXISTS quality_trends_daily CASCADE;
DROP VIEW IF EXISTS partial_analysis_calls CASCADE;

-- View: Calls with low quality (excluding deleted)
CREATE OR REPLACE VIEW low_quality_calls AS
SELECT
  id,
  client_name,
  call_date,
  closer_id,
  analysis_quality_score,
  analysis_metadata->>'is_partial_analysis' AS is_partial,
  analysis_metadata->>'chunks_analyzed' AS chunks_analyzed,
  analysis_metadata->>'chunks_total' AS chunks_total,
  analyzed_at,
  LENGTH(transcription) AS transcription_length
FROM calls
WHERE analysis_quality_score IS NOT NULL
  AND analysis_quality_score < 60
  AND deleted_at IS NULL
ORDER BY analysis_quality_score ASC;

-- View: Quality distribution by closer (excluding deleted)
CREATE OR REPLACE VIEW quality_by_closer AS
SELECT
  closer_id,
  COUNT(*) AS total_calls,
  AVG(analysis_quality_score) AS avg_quality,
  MIN(analysis_quality_score) AS min_quality,
  MAX(analysis_quality_score) AS max_quality,
  COUNT(*) FILTER (WHERE analysis_quality_score >= 80) AS excellent_count,
  COUNT(*) FILTER (WHERE analysis_quality_score >= 60 AND analysis_quality_score < 80) AS good_count,
  COUNT(*) FILTER (WHERE analysis_quality_score < 60) AS poor_count
FROM calls
WHERE analysis_quality_score IS NOT NULL
  AND deleted_at IS NULL
GROUP BY closer_id
ORDER BY avg_quality DESC;

-- View: Quality trends over time (excluding deleted)
CREATE OR REPLACE VIEW quality_trends_daily AS
SELECT
  DATE_TRUNC('day', analyzed_at) AS day,
  COUNT(*) AS calls_analyzed,
  AVG(analysis_quality_score) AS avg_quality,
  COUNT(*) FILTER (WHERE analysis_quality_score < 60) AS low_quality_count,
  COUNT(*) FILTER (WHERE analysis_metadata->>'is_partial_analysis' = 'true') AS partial_analysis_count
FROM calls
WHERE analyzed_at IS NOT NULL
  AND analysis_quality_score IS NOT NULL
  AND deleted_at IS NULL
GROUP BY DATE_TRUNC('day', analyzed_at)
ORDER BY day DESC;

-- View: Partial analysis calls (excluding deleted)
CREATE OR REPLACE VIEW partial_analysis_calls AS
SELECT
  c.id,
  c.client_name,
  c.call_date,
  c.score,
  c.analysis_metadata->>'is_partial_analysis' AS is_partial,
  (c.analysis_metadata->>'chunks_analyzed')::INT AS chunks_analyzed,
  (c.analysis_metadata->>'chunks_total')::INT AS chunks_total
FROM calls c
WHERE c.analysis_metadata->>'is_partial_analysis' = 'true'
  AND c.deleted_at IS NULL;

-- ============= DELETED CALLS VIEW =============

CREATE OR REPLACE VIEW deleted_calls AS
SELECT
  id,
  client_name,
  call_date,
  closer_id,
  deleted_at,
  deleted_by,
  EXTRACT(EPOCH FROM (NOW() - deleted_at)) / 86400 AS days_since_deletion,
  LENGTH(transcription) AS transcription_length
FROM calls
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- ============= SOFT DELETE FUNCTION =============

CREATE OR REPLACE FUNCTION soft_delete_call(
  p_call_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_call_closer_id UUID;
BEGIN
  -- Check if call exists and belongs to user
  SELECT closer_id INTO v_call_closer_id
  FROM calls
  WHERE id = p_call_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found or already deleted';
  END IF;

  IF v_call_closer_id != p_user_id THEN
    RAISE EXCEPTION 'User does not own this call';
  END IF;

  -- Soft delete the call
  UPDATE calls
  SET deleted_at = NOW(),
      deleted_by = p_user_id
  WHERE id = p_call_id;

  RETURN TRUE;
END;
$$;

-- ============= RESTORE FUNCTION =============

CREATE OR REPLACE FUNCTION restore_call(
  p_call_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_call_closer_id UUID;
  v_deleted_at TIMESTAMPTZ;
BEGIN
  -- Check if call exists and belongs to user
  SELECT closer_id, deleted_at INTO v_call_closer_id, v_deleted_at
  FROM calls
  WHERE id = p_call_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call not found';
  END IF;

  IF v_call_closer_id != p_user_id THEN
    RAISE EXCEPTION 'User does not own this call';
  END IF;

  IF v_deleted_at IS NULL THEN
    RAISE EXCEPTION 'Call is not deleted';
  END IF;

  -- Check if deletion was within 30 days
  IF (NOW() - v_deleted_at) > INTERVAL '30 days' THEN
    RAISE EXCEPTION 'Call was deleted more than 30 days ago and cannot be restored';
  END IF;

  -- Restore the call
  UPDATE calls
  SET deleted_at = NULL,
      deleted_by = NULL
  WHERE id = p_call_id;

  RETURN TRUE;
END;
$$;

-- ============= PERMANENT DELETE FUNCTION =============

CREATE OR REPLACE FUNCTION permanent_delete_old_calls()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Permanently delete calls that were soft-deleted more than 30 days ago
  DELETE FROM calls
  WHERE deleted_at IS NOT NULL
    AND deleted_at < (NOW() - INTERVAL '30 days');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN v_deleted_count;
END;
$$;

-- ============= EXPORT USER DATA FUNCTION =============

CREATE OR REPLACE FUNCTION export_user_data(
  p_user_id UUID,
  p_include_deleted BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
  call_id UUID,
  client_name TEXT,
  call_date DATE,
  transcription TEXT,
  analysis JSONB,
  created_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS call_id,
    c.client_name,
    c.call_date,
    c.transcription,
    jsonb_build_object(
      'score', c.score,
      'status', c.status,
      'niche', c.niche,
      'main_difficulty', c.main_difficulty,
      'main_pain', c.main_pain,
      'ai_summary', c.ai_summary,
      'lead_classification', c.lead_classification,
      'closer_classification', c.closer_classification,
      'technical_analysis', c.technical_analysis,
      'main_errors', c.main_errors,
      'main_wins', c.main_wins,
      'analysis_metadata', c.analysis_metadata
    ) AS analysis,
    c.created_at,
    c.deleted_at
  FROM calls c
  WHERE c.closer_id = p_user_id
    AND (p_include_deleted OR c.deleted_at IS NULL)
  ORDER BY c.call_date DESC, c.created_at DESC;
END;
$$;

-- ============= CRON JOB FOR CLEANUP (requires pg_cron extension) =============
-- Note: This requires pg_cron extension which may not be available in all Supabase tiers
-- To enable: Run "CREATE EXTENSION pg_cron;" as superuser if available

-- CREATE OR REPLACE FUNCTION schedule_permanent_deletion()
-- RETURNS void
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   PERFORM cron.schedule(
--     'permanent-delete-old-calls',
--     '0 2 * * *', -- Run daily at 2 AM
--     $$ SELECT permanent_delete_old_calls(); $$
--   );
-- END;
-- $$;

-- ============= RLS POLICIES =============

-- Update RLS policies to respect soft delete
DROP POLICY IF EXISTS "Users can view own calls" ON calls;
DROP POLICY IF EXISTS "Users can insert own calls" ON calls;
DROP POLICY IF EXISTS "Users can update own calls" ON calls;
DROP POLICY IF EXISTS "Users can delete own calls" ON calls;

CREATE POLICY "Users can view own active calls"
  ON calls
  FOR SELECT
  USING (auth.uid() = closer_id AND deleted_at IS NULL);

CREATE POLICY "Users can view own deleted calls"
  ON calls
  FOR SELECT
  USING (auth.uid() = closer_id AND deleted_at IS NOT NULL);

CREATE POLICY "Users can insert own calls"
  ON calls
  FOR INSERT
  WITH CHECK (auth.uid() = closer_id);

CREATE POLICY "Users can update own active calls"
  ON calls
  FOR UPDATE
  USING (auth.uid() = closer_id)
  WITH CHECK (auth.uid() = closer_id);

-- Soft delete via function only
-- Users should call soft_delete_call() instead of DELETE

-- ============= GRANT PERMISSIONS =============

GRANT SELECT ON deleted_calls TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_call TO authenticated;
GRANT EXECUTE ON FUNCTION restore_call TO authenticated;
GRANT EXECUTE ON FUNCTION export_user_data TO authenticated;

-- Comments
COMMENT ON COLUMN calls.deleted_at IS 'Timestamp when call was soft-deleted (NULL if active). Calls deleted >30 days are permanently removed.';
COMMENT ON COLUMN calls.deleted_by IS 'User ID who deleted the call';
COMMENT ON VIEW deleted_calls IS 'Recently deleted calls (within 30 days) that can be restored';
COMMENT ON FUNCTION soft_delete_call IS 'Soft delete a call (can be restored within 30 days)';
COMMENT ON FUNCTION restore_call IS 'Restore a soft-deleted call (must be within 30 days of deletion)';
COMMENT ON FUNCTION permanent_delete_old_calls IS 'Permanently delete calls that were soft-deleted >30 days ago (run daily via cron)';
COMMENT ON FUNCTION export_user_data IS 'Export all user data in JSON format for backup/migration';
