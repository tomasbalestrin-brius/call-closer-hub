-- Migration: Quality Metrics for Analysis
-- Description: Add quality scoring to track analysis completeness and reliability
-- Author: Claude
-- Date: 2026-01-23

-- ============= ADD QUALITY SCORE COLUMN =============

ALTER TABLE calls ADD COLUMN IF NOT EXISTS analysis_quality_score INTEGER;

-- Index for filtering by quality
CREATE INDEX IF NOT EXISTS idx_calls_quality_score ON calls(analysis_quality_score);

-- ============= QUALITY CALCULATION FUNCTION =============

CREATE OR REPLACE FUNCTION calculate_analysis_quality_score(call_record calls)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_score INTEGER := 0;
  v_field_count INTEGER := 0;
  v_filled_count INTEGER := 0;
BEGIN
  -- Score based on field completeness (0-40 points)
  -- Count total extractable fields and how many are filled

  IF call_record.client_name IS NOT NULL AND LENGTH(call_record.client_name) > 0 THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.niche IS NOT NULL AND LENGTH(call_record.niche) > 0 THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.has_partner IS NOT NULL THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.main_difficulty IS NOT NULL AND LENGTH(call_record.main_difficulty) > 0 THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.main_pain IS NOT NULL AND LENGTH(call_record.main_pain) > 0 THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.consciousness_level IS NOT NULL AND LENGTH(call_record.consciousness_level) > 0 THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.decision_reason IS NOT NULL AND LENGTH(call_record.decision_reason) > 0 THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.ai_summary IS NOT NULL AND LENGTH(call_record.ai_summary) > 100 THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.lead_classification IS NOT NULL THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  IF call_record.closer_classification IS NOT NULL THEN
    v_filled_count := v_filled_count + 1;
  END IF;
  v_field_count := v_field_count + 1;

  -- Field completeness score: (filled / total) * 40
  v_score := v_score + ROUND((v_filled_count::DECIMAL / v_field_count::DECIMAL) * 40);

  -- Framework confidence score (0-30 points)
  IF call_record.technical_analysis IS NOT NULL THEN
    DECLARE
      v_confidence INTEGER := (call_record.technical_analysis->>'confianca_framework')::INTEGER;
    BEGIN
      IF v_confidence IS NOT NULL THEN
        -- Map confidence (1-10) to points (0-30)
        v_score := v_score + (v_confidence * 3);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Invalid confidence value, skip
      NULL;
    END;
  END IF;

  -- Analysis metadata completeness (0-30 points)
  IF call_record.analysis_metadata IS NOT NULL THEN
    DECLARE
      v_is_partial BOOLEAN := (call_record.analysis_metadata->>'is_partial_analysis')::BOOLEAN;
      v_chunks_analyzed INTEGER := (call_record.analysis_metadata->>'chunks_analyzed')::INTEGER;
      v_chunks_total INTEGER := (call_record.analysis_metadata->>'chunks_total')::INTEGER;
      v_completeness_ratio DECIMAL;
    BEGIN
      IF v_is_partial = FALSE THEN
        -- Complete analysis = full points
        v_score := v_score + 30;
      ELSIF v_chunks_analyzed IS NOT NULL AND v_chunks_total IS NOT NULL AND v_chunks_total > 0 THEN
        -- Partial analysis: score based on chunks analyzed
        v_completeness_ratio := v_chunks_analyzed::DECIMAL / v_chunks_total::DECIMAL;
        v_score := v_score + ROUND(v_completeness_ratio * 30);
      ELSE
        -- No metadata = assume complete
        v_score := v_score + 30;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Invalid metadata, assume complete
      v_score := v_score + 30;
    END;
  ELSE
    -- No metadata = assume complete analysis
    v_score := v_score + 30;
  END IF;

  RETURN v_score;
END;
$$;

-- ============= TRIGGER TO AUTO-CALCULATE QUALITY =============

CREATE OR REPLACE FUNCTION update_analysis_quality_score()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate and set quality score when analysis fields are updated
  IF NEW.analyzed_at IS NOT NULL AND OLD.analyzed_at IS DISTINCT FROM NEW.analyzed_at THEN
    NEW.analysis_quality_score := calculate_analysis_quality_score(NEW);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_analysis_quality ON calls;

CREATE TRIGGER trigger_update_analysis_quality
  BEFORE INSERT OR UPDATE ON calls
  FOR EACH ROW
  EXECUTE FUNCTION update_analysis_quality_score();

-- ============= VIEWS FOR QUALITY MONITORING =============

-- View: Calls with low quality (need review)
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
ORDER BY analysis_quality_score ASC;

-- View: Quality distribution by closer
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
GROUP BY closer_id
ORDER BY avg_quality DESC;

-- View: Quality trends over time
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
GROUP BY DATE_TRUNC('day', analyzed_at)
ORDER BY day DESC;

-- ============= BACKFILL EXISTING CALLS =============

-- Update quality scores for existing calls that have been analyzed
UPDATE calls
SET analysis_quality_score = calculate_analysis_quality_score(calls.*)
WHERE analyzed_at IS NOT NULL
  AND analysis_quality_score IS NULL;

-- ============= GRANT PERMISSIONS =============

GRANT SELECT ON low_quality_calls TO authenticated;
GRANT SELECT ON quality_by_closer TO authenticated;
GRANT SELECT ON quality_trends_daily TO authenticated;

-- Comments
COMMENT ON COLUMN calls.analysis_quality_score IS 'Quality score (0-100) based on field completeness, framework confidence, and analysis completeness';
COMMENT ON VIEW low_quality_calls IS 'Calls with quality score < 60 that may need manual review or re-analysis';
COMMENT ON VIEW quality_by_closer IS 'Analysis quality metrics aggregated by closer for performance monitoring';
COMMENT ON FUNCTION calculate_analysis_quality_score IS 'Calculates quality score (0-100): 40pts field completeness + 30pts confidence + 30pts analysis completeness';
