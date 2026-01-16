-- Create audit logs table for administrative actions
CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  performed_by UUID NOT NULL,
  target_user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_audit_performed_by ON admin_audit_logs(performed_by);
CREATE INDEX idx_audit_target_user ON admin_audit_logs(target_user_id);
CREATE INDEX idx_audit_action_type ON admin_audit_logs(action_type);
CREATE INDEX idx_audit_created_at ON admin_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view audit logs"
ON admin_audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Leaders can view audit logs for their actions and their squad members
CREATE POLICY "Leaders can view their audit logs"
ON admin_audit_logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'lider') AND (
    performed_by = auth.uid() OR 
    public.is_squad_leader_of_user(auth.uid(), target_user_id)
  )
);

-- Authenticated users can insert audit logs (for their own actions)
CREATE POLICY "Authenticated users can insert audit logs"
ON admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = performed_by);