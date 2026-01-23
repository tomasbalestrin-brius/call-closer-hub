# 🚀 Call Closer Hub - Deployment Guide

## Pre-requisites

- Supabase project (or Lovable Cloud with Supabase backend)
- OpenAI API account with API key
- Google Cloud project with OAuth 2.0 credentials
- Node.js 18+ (for local development)

---

## 1. Environment Variables Setup

### Required Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in the following variables:

#### **Supabase Configuration**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Backend only
```

**Where to get:**
- Go to Supabase Dashboard → Settings → API
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = `anon` `public` key
- `SUPABASE_SERVICE_ROLE_KEY` = `service_role` `secret` key (never expose to frontend!)

#### **OpenAI Configuration**
```env
OPENAI_API_KEY=sk-...your-key
```

**Where to get:**
- Go to https://platform.openai.com/api-keys
- Create new secret key
- **IMPORTANT**: Enable billing and set spending limits!

#### **Google OAuth Configuration**
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

**Where to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project or select existing
3. Enable Google Drive API and Google Docs API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
   - `http://localhost:5173/auth/callback` (for local dev)

---

## 2. Database Migrations

### Option A: Using Lovable Cloud
Lovable automatically applies migrations when you merge to `main`. Just create a Pull Request and merge.

### Option B: Using Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Verify Migrations
After deployment, check that all tables exist:
```sql
-- Run in Supabase SQL Editor
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

Should include:
- `calls`
- `imported_files`
- `api_costs`
- `api_rate_limits`
- `system_logs`
- etc.

---

## 3. Edge Functions Deployment

### Option A: Using Lovable Cloud
Edge Functions are automatically deployed on push to `main`.

### Option B: Using Supabase CLI
```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy analyze-call
supabase functions deploy import-and-analyze
# etc.
```

### Set Environment Secrets
```bash
# Set OpenAI API key for Edge Functions
supabase secrets set OPENAI_API_KEY=sk-...your-key

# Verify secrets
supabase secrets list
```

---

## 4. Initial Configuration

### Set Default User Budget
All users get $100/month budget by default. To change:

```sql
-- Set default for new users
ALTER TABLE profiles ALTER COLUMN monthly_budget_usd SET DEFAULT 50.00;

-- Update existing users
UPDATE profiles SET monthly_budget_usd = 50.00;

-- Give admin unlimited budget
UPDATE profiles SET monthly_budget_usd = NULL WHERE user_role = 'admin';
```

### Configure System Settings
```sql
-- Check system health
SELECT * FROM system_metrics_24h;

-- View API rate limits
SELECT * FROM api_rate_limits;
```

---

## 5. Testing the Deployment

### 5.1 Test Authentication
1. Go to your app URL
2. Sign up with Google
3. Verify user created in `profiles` table

### 5.2 Test Google Drive Import
1. Connect Google Drive account
2. Select a folder
3. Click "Import"
4. Check `imported_files` table for status

### 5.3 Test Analysis
1. Import a call transcript
2. Wait for analysis to complete
3. Check `calls` table for results
4. Verify `api_costs` table logged the cost

### 5.4 Test Budget Protection
```sql
-- Set low budget for testing
UPDATE profiles SET monthly_budget_usd = 0.10 WHERE email = 'test@example.com';

-- Try importing a file (should fail with budget exceeded)
```

### 5.5 Test Health Check
```bash
curl https://your-project.supabase.co/functions/v1/health-check
```

Should return:
```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "openai_api": "ok",
    "stuck_files": "ok",
    "file_backlog": "ok",
    "recent_errors": "ok"
  }
}
```

---

## 6. Monitoring & Alerts

### View System Health
```sql
-- Health check status
SELECT * FROM system_health_check;

-- Stuck files (>10 minutes processing)
SELECT * FROM stuck_files_report;

-- Recent errors (last 24h)
SELECT * FROM system_metrics_24h WHERE errors > 0;
```

### View Costs
```sql
-- Total costs today
SELECT SUM(cost_usd) FROM api_costs WHERE DATE(created_at) = CURRENT_DATE;

-- Costs by user this month
SELECT * FROM monthly_costs_by_user;

-- Users over budget
SELECT * FROM budget_exceeded_users;

-- Users approaching limit (80%+)
SELECT * FROM budget_warning_users;
```

### View Quality Metrics
```sql
-- Low quality calls (score <60)
SELECT * FROM low_quality_calls;

-- Quality trends
SELECT * FROM quality_trends_daily ORDER BY day DESC LIMIT 7;

-- Average quality by closer
SELECT * FROM quality_by_closer;
```

---

## 7. Maintenance

### Monthly Cleanup
```sql
-- Reset budget warning flags (run on 1st of month)
SELECT reset_monthly_budget_warnings();

-- Permanently delete soft-deleted calls >30 days old
SELECT permanent_delete_old_calls();
```

### Backup
```bash
# Export all user data (as user)
curl -X POST https://your-project.supabase.co/functions/v1/export-user-data \
  -H "Authorization: Bearer user-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"includeDeleted": true, "format": "json"}' \
  > backup.json
```

### Database Backup (Supabase Dashboard)
1. Go to Database → Backups
2. Enable automatic daily backups
3. Point-in-time recovery available (depends on plan)

---

## 8. Troubleshooting

### Issue: "OPENAI_API_KEY not configured"
**Solution**: Set the secret in Supabase Edge Functions
```bash
supabase secrets set OPENAI_API_KEY=sk-your-key
```

### Issue: Files stuck in "processing" status
**Solution**: Check stuck files and reset them
```sql
SELECT * FROM stuck_files_report;

-- Reset stuck files (sets to pending for retry)
UPDATE imported_files
SET status = 'pending', started_processing_at = NULL
WHERE status = 'processing'
  AND started_processing_at < NOW() - INTERVAL '10 minutes';
```

### Issue: Budget exceeded but user should have budget
**Solution**: Check current spend and reset if needed
```sql
-- View budget status
SELECT * FROM user_budget_status WHERE user_id = 'user-uuid';

-- Increase budget
SELECT set_user_budget('user-uuid', 200.00);

-- Set unlimited (admin only)
SELECT set_user_budget('user-uuid', NULL);
```

### Issue: Analysis timeout
**Check**:
1. Transcription length (should be <500KB)
2. OpenAI API status: https://status.openai.com/
3. Edge Function logs in Supabase Dashboard

### Issue: Duplicate calls created
**Check**:
```sql
-- Find duplicates by content hash
SELECT content_hash, COUNT(*) as count
FROM calls
WHERE content_hash IS NOT NULL
GROUP BY content_hash
HAVING COUNT(*) > 1;

-- Soft delete duplicates (keep oldest)
SELECT soft_delete_call('duplicate-call-id', 'user-id');
```

---

## 9. Performance Optimization

### If experiencing slow imports:
1. Check `imported_files` table size: `SELECT COUNT(*) FROM imported_files;`
2. Archive old completed files if >10,000 rows
3. Check database connection limits in Supabase Dashboard

### If API costs are too high:
1. Review `expensive_calls` view
2. Consider using gpt-4o-mini for all analysis (cheaper)
3. Reduce batch processing size
4. Lower user budgets

---

## 10. Rollback Plan

If deployment causes issues:

### Rollback Migrations
```bash
# Revert last migration
supabase db reset --db-url "postgresql://..."

# Or manually:
DROP TABLE IF EXISTS api_costs;
-- etc.
```

### Rollback Edge Functions
```bash
# Deploy previous version
git checkout previous-commit
supabase functions deploy
```

### Emergency Stop
```sql
-- Disable all processing
UPDATE profiles SET monthly_budget_usd = 0;

-- Or pause specific user
UPDATE profiles SET monthly_budget_usd = 0 WHERE user_id = 'problem-user-id';
```

---

## 11. Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is NOT exposed to frontend
- [ ] `OPENAI_API_KEY` is set as Edge Function secret (not in code)
- [ ] Google OAuth redirect URIs are whitelisted
- [ ] RLS policies enabled on all tables
- [ ] User budgets are set appropriately ($100 default)
- [ ] Admin users have proper roles in `profiles.user_role`
- [ ] Rate limits configured (100 requests/hour, 10M tokens/hour)

---

## 12. Support

For issues:
1. Check Supabase Edge Function logs
2. Query `system_logs` table for errors
3. Run health check endpoint
4. Review this troubleshooting guide

**Monitoring Dashboard**: `/admin` (for admin users)

**Cost Dashboard**: Profile → Settings → Budget & Costs
