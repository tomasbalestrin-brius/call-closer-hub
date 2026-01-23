-- Migration: API Cost Tracking
-- Description: Track actual API costs per request for OpenAI/Anthropic usage
-- Author: Claude
-- Date: 2026-01-23

-- ============= API COSTS TABLE =============
CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL, -- 'openai', 'anthropic', etc.
  model TEXT NOT NULL, -- 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', etc.
  operation TEXT NOT NULL, -- 'analyze-call', 'analyze-chunk', 'merge-analysis', etc.
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  tokens_total INTEGER NOT NULL GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0, -- Cost in USD (6 decimal precision)
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  file_id UUID REFERENCES imported_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_costs_user_id ON api_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_costs_created_at ON api_costs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_costs_service ON api_costs(service);
CREATE INDEX IF NOT EXISTS idx_api_costs_model ON api_costs(model);
CREATE INDEX IF NOT EXISTS idx_api_costs_user_created ON api_costs(user_id, created_at DESC);

-- ============= COST TRACKING VIEWS =============

-- View: Monthly costs by user
CREATE OR REPLACE VIEW monthly_costs_by_user AS
SELECT
  user_id,
  DATE_TRUNC('month', created_at) AS month,
  service,
  model,
  COUNT(*) AS request_count,
  SUM(tokens_input) AS total_input_tokens,
  SUM(tokens_output) AS total_output_tokens,
  SUM(tokens_total) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd
FROM api_costs
GROUP BY user_id, DATE_TRUNC('month', created_at), service, model
ORDER BY month DESC, total_cost_usd DESC;

-- View: Daily costs aggregated
CREATE OR REPLACE VIEW daily_costs_summary AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  service,
  model,
  COUNT(*) AS request_count,
  SUM(tokens_total) AS total_tokens,
  SUM(cost_usd) AS total_cost_usd,
  AVG(cost_usd) AS avg_cost_per_request
FROM api_costs
GROUP BY DATE_TRUNC('day', created_at), service, model
ORDER BY day DESC;

-- View: Current month costs per user (for budget limits)
CREATE OR REPLACE VIEW current_month_user_costs AS
SELECT
  user_id,
  COUNT(*) AS requests_this_month,
  SUM(tokens_total) AS tokens_this_month,
  SUM(cost_usd) AS cost_this_month_usd
FROM api_costs
WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP)
GROUP BY user_id;

-- View: Most expensive calls (for optimization)
CREATE OR REPLACE VIEW expensive_calls AS
SELECT
  c.id AS call_id,
  c.client_name,
  c.call_date,
  c.closer_id,
  SUM(ac.cost_usd) AS total_cost_usd,
  SUM(ac.tokens_total) AS total_tokens,
  COUNT(ac.id) AS api_requests,
  c.analysis_metadata->>'chunks_total' AS chunks_total,
  LENGTH(c.transcription) AS transcription_length
FROM calls c
JOIN api_costs ac ON ac.call_id = c.id
GROUP BY c.id, c.client_name, c.call_date, c.closer_id, c.analysis_metadata, c.transcription
ORDER BY total_cost_usd DESC
LIMIT 100;

-- ============= COST CALCULATION FUNCTION =============

-- Function to calculate cost based on OpenAI/Anthropic pricing
CREATE OR REPLACE FUNCTION calculate_api_cost(
  p_service TEXT,
  p_model TEXT,
  p_tokens_input INTEGER,
  p_tokens_output INTEGER
) RETURNS DECIMAL(10, 6)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost_input DECIMAL(10, 9);
  v_cost_output DECIMAL(10, 9);
  v_total_cost DECIMAL(10, 6);
BEGIN
  -- OpenAI Pricing (as of Jan 2026)
  IF p_service = 'openai' THEN
    CASE p_model
      WHEN 'gpt-4o' THEN
        v_cost_input := 0.0000025;  -- $2.50 per 1M input tokens
        v_cost_output := 0.00001;   -- $10.00 per 1M output tokens
      WHEN 'gpt-4o-mini' THEN
        v_cost_input := 0.00000015; -- $0.15 per 1M input tokens
        v_cost_output := 0.0000006; -- $0.60 per 1M output tokens
      ELSE
        -- Default to gpt-4o pricing
        v_cost_input := 0.0000025;
        v_cost_output := 0.00001;
    END CASE;
  -- Anthropic Pricing (for future fallback)
  ELSIF p_service = 'anthropic' THEN
    CASE p_model
      WHEN 'claude-3-5-sonnet-20241022' THEN
        v_cost_input := 0.000003;   -- $3.00 per 1M input tokens
        v_cost_output := 0.000015;  -- $15.00 per 1M output tokens
      WHEN 'claude-3-5-haiku-20241022' THEN
        v_cost_input := 0.000001;   -- $1.00 per 1M input tokens
        v_cost_output := 0.000005;  -- $5.00 per 1M output tokens
      ELSE
        v_cost_input := 0.000003;
        v_cost_output := 0.000015;
    END CASE;
  ELSE
    -- Unknown service, return 0
    RETURN 0;
  END IF;

  v_total_cost := (p_tokens_input * v_cost_input) + (p_tokens_output * v_cost_output);
  RETURN v_total_cost;
END;
$$;

-- ============= LOG COST FUNCTION =============

-- Function to log API cost (called from Edge Functions)
CREATE OR REPLACE FUNCTION log_api_cost(
  p_user_id UUID,
  p_service TEXT,
  p_model TEXT,
  p_operation TEXT,
  p_tokens_input INTEGER,
  p_tokens_output INTEGER,
  p_call_id UUID DEFAULT NULL,
  p_file_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost_usd DECIMAL(10, 6);
  v_cost_id UUID;
BEGIN
  -- Calculate cost
  v_cost_usd := calculate_api_cost(p_service, p_model, p_tokens_input, p_tokens_output);

  -- Insert cost record
  INSERT INTO api_costs (
    user_id,
    service,
    model,
    operation,
    tokens_input,
    tokens_output,
    cost_usd,
    call_id,
    file_id
  ) VALUES (
    p_user_id,
    p_service,
    p_model,
    p_operation,
    p_tokens_input,
    p_tokens_output,
    v_cost_usd,
    p_call_id,
    p_file_id
  )
  RETURNING id INTO v_cost_id;

  RETURN v_cost_id;
END;
$$;

-- ============= RLS POLICIES =============

ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;

-- Users can view their own costs
CREATE POLICY "Users can view own API costs"
  ON api_costs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert costs
CREATE POLICY "Service role can insert API costs"
  ON api_costs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============= GRANT PERMISSIONS =============

GRANT SELECT ON api_costs TO authenticated;
GRANT ALL ON api_costs TO service_role;
GRANT SELECT ON monthly_costs_by_user TO authenticated;
GRANT SELECT ON daily_costs_summary TO authenticated;
GRANT SELECT ON current_month_user_costs TO authenticated;
GRANT SELECT ON expensive_calls TO authenticated;

-- Comment on table
COMMENT ON TABLE api_costs IS 'Tracks actual API usage and costs per request for OpenAI, Anthropic, and other AI services';
COMMENT ON COLUMN api_costs.cost_usd IS 'Calculated cost in USD based on model pricing and token usage';
COMMENT ON FUNCTION log_api_cost IS 'Log API cost from Edge Functions. Automatically calculates cost based on service and model.';
