-- First, drop the old constraint and add one that includes 'cancelled'
ALTER TABLE import_progress DROP CONSTRAINT IF EXISTS import_progress_status_check;
ALTER TABLE import_progress ADD CONSTRAINT import_progress_status_check 
  CHECK (status IN ('running', 'completed', 'error', 'cancelled'));

-- Reset all stuck files in 'processing' status to 'pending'
UPDATE imported_files 
SET status = 'pending' 
WHERE status = 'processing';

-- Cancel all orphaned running sessions
UPDATE import_progress 
SET status = 'cancelled', completed_at = NOW() 
WHERE status = 'running';

-- Add column to track when processing started (for timeout detection)
ALTER TABLE imported_files 
ADD COLUMN IF NOT EXISTS started_processing_at TIMESTAMPTZ DEFAULT NULL;

-- Create user_import_sessions table for isolated per-user processing
CREATE TABLE IF NOT EXISTS user_import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'error', 'cancelled')),
  total_files INTEGER DEFAULT 0,
  processed_files INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  current_file_name TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to ensure one session per user
ALTER TABLE user_import_sessions 
ADD CONSTRAINT one_active_session_per_user UNIQUE (user_id);

-- Enable RLS
ALTER TABLE user_import_sessions ENABLE ROW LEVEL SECURITY;

-- Admins and leaders can view all sessions
CREATE POLICY "Admins and leaders can view all sessions" ON user_import_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'lider'))
  );

-- Users can view their own session
CREATE POLICY "Users can view own session" ON user_import_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Allow service role full access for edge functions
CREATE POLICY "Service role has full access" ON user_import_sessions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable realtime for live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE user_import_sessions;