-- Migration: Budget Protection and Enforcement
-- Description: Add per-user monthly budget limits with enforcement
-- Author: Claude
-- Date: 2026-01-23

-- ============= ADD BUDGET COLUMN TO PROFILES =============

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_budget_usd DECIMAL(10, 2) DEFAULT 100.00;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_warning_sent BOOLEAN DEFAULT FALSE;

-- Index for budget queries
CREATE INDEX IF NOT EXISTS idx_profiles_budget ON profiles(monthly_budget_usd);

COMMENT ON COLUMN profiles.monthly_budget_usd IS 'Monthly API cost budget in USD (default $100). Set to NULL for unlimited budget (admins only).';
COMMENT ON COLUMN profiles.budget_warning_sent IS 'Flag indicating if 80% budget warning was sent this month';

-- ============= BUDGET CHECK FUNCTION =============

CREATE OR REPLACE FUNCTION check_user_budget(
  p_user_id UUID,
  p_estimated_cost DECIMAL(10, 6) DEFAULT 0.50 -- Default estimate for 1 analysis
) RETURNS TABLE (
  allowed BOOLEAN,
  current_spend_usd DECIMAL(10, 2),
  monthly_limit_usd DECIMAL(10, 2),
  remaining_usd DECIMAL(10, 2),
  usage_percent INTEGER,
  warning_threshold_reached BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_spend DECIMAL(10, 2);
  v_monthly_limit DECIMAL(10, 2);
  v_remaining DECIMAL(10, 2);
  v_usage_percent INTEGER;
  v_allowed BOOLEAN;
  v_warning_threshold BOOLEAN;
BEGIN
  -- Get user's monthly budget limit
  SELECT monthly_budget_usd INTO v_monthly_limit
  FROM profiles
  WHERE user_id = p_user_id;

  -- If no limit set (NULL), allow unlimited (admin override)
  IF v_monthly_limit IS NULL THEN
    RETURN QUERY SELECT
      TRUE::BOOLEAN,
      0::DECIMAL(10, 2),
      NULL::DECIMAL(10, 2),
      NULL::DECIMAL(10, 2),
      0::INTEGER,
      FALSE::BOOLEAN;
    RETURN;
  END IF;

  -- Calculate current month spend
  SELECT COALESCE(SUM(cost_usd), 0) INTO v_current_spend
  FROM api_costs
  WHERE user_id = p_user_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_TIMESTAMP);

  -- Calculate remaining budget
  v_remaining := v_monthly_limit - v_current_spend;

  -- Calculate usage percentage
  v_usage_percent := ROUND((v_current_spend / v_monthly_limit) * 100);

  -- Check if warning threshold (80%) reached
  v_warning_threshold := v_usage_percent >= 80;

  -- Allow if current spend + estimated cost <= limit
  v_allowed := (v_current_spend + p_estimated_cost) <= v_monthly_limit;

  RETURN QUERY SELECT
    v_allowed,
    v_current_spend,
    v_monthly_limit,
    v_remaining,
    v_usage_percent,
    v_warning_threshold;
END;
$$;

-- ============= BUDGET USAGE VIEW =============

CREATE OR REPLACE VIEW user_budget_status AS
SELECT
  p.user_id,
  p.full_name,
  p.email,
  p.monthly_budget_usd AS budget_limit_usd,
  COALESCE(c.cost_this_month, 0) AS current_spend_usd,
  p.monthly_budget_usd - COALESCE(c.cost_this_month, 0) AS remaining_usd,
  CASE
    WHEN p.monthly_budget_usd IS NULL THEN 0
    WHEN p.monthly_budget_usd = 0 THEN 0
    ELSE ROUND((COALESCE(c.cost_this_month, 0) / p.monthly_budget_usd) * 100)
  END AS usage_percent,
  CASE
    WHEN p.monthly_budget_usd IS NULL THEN 'unlimited'
    WHEN COALESCE(c.cost_this_month, 0) >= p.monthly_budget_usd THEN 'exceeded'
    WHEN COALESCE(c.cost_this_month, 0) >= (p.monthly_budget_usd * 0.8) THEN 'warning'
    ELSE 'normal'
  END AS status,
  c.requests_this_month
FROM profiles p
LEFT JOIN current_month_user_costs c ON p.user_id = c.user_id;

-- View: Users who exceeded budget
CREATE OR REPLACE VIEW budget_exceeded_users AS
SELECT
  user_id,
  full_name,
  email,
  current_spend_usd,
  budget_limit_usd,
  current_spend_usd - budget_limit_usd AS overspend_usd,
  usage_percent
FROM user_budget_status
WHERE status = 'exceeded'
ORDER BY overspend_usd DESC;

-- View: Users approaching budget limit (80%+)
CREATE OR REPLACE VIEW budget_warning_users AS
SELECT
  user_id,
  full_name,
  email,
  current_spend_usd,
  budget_limit_usd,
  remaining_usd,
  usage_percent
FROM user_budget_status
WHERE status = 'warning'
ORDER BY usage_percent DESC;

-- ============= RESET BUDGET WARNING FLAGS (Monthly Cron) =============

CREATE OR REPLACE FUNCTION reset_monthly_budget_warnings()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Reset warning flags on the 1st of each month
  UPDATE profiles
  SET budget_warning_sent = FALSE
  WHERE budget_warning_sent = TRUE;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  RETURN v_reset_count;
END;
$$;

-- ============= INCREASE BUDGET FUNCTION (Admin Only) =============

CREATE OR REPLACE FUNCTION set_user_budget(
  p_user_id UUID,
  p_new_limit_usd DECIMAL(10, 2)
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate limit is positive or NULL (unlimited)
  IF p_new_limit_usd IS NOT NULL AND p_new_limit_usd < 0 THEN
    RAISE EXCEPTION 'Budget limit must be positive or NULL (unlimited)';
  END IF;

  UPDATE profiles
  SET monthly_budget_usd = p_new_limit_usd,
      budget_warning_sent = FALSE
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN TRUE;
END;
$$;

-- ============= GRANT PERMISSIONS =============

GRANT SELECT ON user_budget_status TO authenticated;
GRANT SELECT ON budget_exceeded_users TO authenticated;
GRANT SELECT ON budget_warning_users TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_budget TO service_role;
GRANT EXECUTE ON FUNCTION check_user_budget TO authenticated;
GRANT EXECUTE ON FUNCTION set_user_budget TO service_role; -- Admin only
GRANT EXECUTE ON FUNCTION reset_monthly_budget_warnings TO service_role;

-- Comments
COMMENT ON FUNCTION check_user_budget IS 'Check if user has budget remaining for API operations. Returns allowed=false if budget exceeded.';
COMMENT ON VIEW user_budget_status IS 'Current budget usage status for all users this month';
COMMENT ON VIEW budget_exceeded_users IS 'Users who exceeded their monthly budget limit';
COMMENT ON VIEW budget_warning_users IS 'Users at 80%+ of monthly budget (warning threshold)';
