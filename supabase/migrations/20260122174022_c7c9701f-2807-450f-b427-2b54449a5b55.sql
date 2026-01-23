-- ============================================================================
-- MIGRATION: Sistema de Backup e Auditoria
-- ============================================================================

-- 1. Tabela de backup de calls
CREATE TABLE IF NOT EXISTS calls_backup (
  id UUID,
  closer_id UUID,
  client_id UUID,
  client_name TEXT,
  call_date DATE,
  call_time TIME,
  status TEXT,
  product TEXT,
  transcription TEXT,
  content_hash TEXT,
  score INTEGER,
  duration_minutes INTEGER,
  niche TEXT,
  has_partner BOOLEAN,
  main_difficulty TEXT,
  main_pain TEXT,
  consciousness_level TEXT,
  decision_reason TEXT,
  ai_summary TEXT,
  lead_classification TEXT,
  closer_classification TEXT,
  technical_analysis JSONB,
  analysis_metadata JSONB,
  main_errors TEXT[],
  main_wins TEXT[],
  loss_point TEXT,
  next_contact_date DATE,
  source_file_id TEXT,
  google_doc_id TEXT,
  analyzed_at TIMESTAMPTZ,
  entry_value NUMERIC,
  sale_value NUMERIC,
  notes TEXT,
  observation TEXT,
  company_name TEXT,
  merged_with_call_id UUID,
  call_conclusion TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Backup specific columns
  backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date TIMESTAMPTZ DEFAULT NOW(),
  backup_reason TEXT NOT NULL CHECK (backup_reason IN ('UPDATE', 'DELETE', 'manual')),
  backed_up_by UUID
);

CREATE INDEX IF NOT EXISTS idx_calls_backup_date ON calls_backup(backup_date DESC);
CREATE INDEX IF NOT EXISTS idx_calls_backup_original_id ON calls_backup(id);

-- 2. Trigger para backup automático de calls
CREATE OR REPLACE FUNCTION backup_call_before_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fazer backup do registro antigo
  INSERT INTO calls_backup (
    id, closer_id, client_id, client_name, call_date, call_time, status,
    product, transcription, content_hash, score, duration_minutes, niche,
    has_partner, main_difficulty, main_pain, consciousness_level, decision_reason,
    ai_summary, lead_classification, closer_classification, technical_analysis,
    analysis_metadata, main_errors, main_wins, loss_point, next_contact_date,
    source_file_id, google_doc_id, analyzed_at, entry_value, sale_value, notes,
    observation, company_name, merged_with_call_id, call_conclusion,
    created_at, updated_at, backup_reason, backed_up_by
  ) VALUES (
    OLD.id, OLD.closer_id, OLD.client_id, OLD.client_name, OLD.call_date, OLD.call_time, OLD.status,
    OLD.product, OLD.transcription, OLD.content_hash, OLD.score, OLD.duration_minutes, OLD.niche,
    OLD.has_partner, OLD.main_difficulty, OLD.main_pain, OLD.consciousness_level, OLD.decision_reason,
    OLD.ai_summary, OLD.lead_classification, OLD.closer_classification, OLD.technical_analysis,
    OLD.analysis_metadata, OLD.main_errors, OLD.main_wins, OLD.loss_point, OLD.next_contact_date,
    OLD.source_file_id, OLD.google_doc_id, OLD.analyzed_at, OLD.entry_value, OLD.sale_value, OLD.notes,
    OLD.observation, OLD.company_name, OLD.merged_with_call_id, OLD.call_conclusion,
    OLD.created_at, OLD.updated_at, TG_OP, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER backup_call_trigger
BEFORE UPDATE OR DELETE ON calls
FOR EACH ROW
EXECUTE FUNCTION backup_call_before_change();

-- 3. Tabela de backup de clients
CREATE TABLE IF NOT EXISTS clients_backup (
  id UUID,
  closer_id UUID,
  name TEXT,
  name_normalized TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  niche TEXT,
  status TEXT,
  source TEXT,
  revenue NUMERIC,
  has_partner BOOLEAN,
  main_difficulty TEXT,
  main_pain TEXT,
  notes TEXT,
  sale_notes TEXT,
  negotiation_notes TEXT,
  entry_value NUMERIC,
  sale_value NUMERIC,
  followup_date DATE,
  contract_validity DATE,
  is_sold BOOLEAN,
  sold_at TIMESTAMPTZ,
  is_from_indication BOOLEAN,
  indication_source_id UUID,
  is_super_hot BOOLEAN,
  data_completed_at TIMESTAMPTZ,
  incomplete_notification_sent BOOLEAN,
  repitch_overdue_notification_sent BOOLEAN,
  status_changed_at TIMESTAMPTZ,
  product_offered TEXT,
  sdr_name TEXT,
  funnel_source TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  -- Backup specific columns
  backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date TIMESTAMPTZ DEFAULT NOW(),
  backup_reason TEXT NOT NULL CHECK (backup_reason IN ('UPDATE', 'DELETE', 'manual')),
  backed_up_by UUID
);

CREATE INDEX IF NOT EXISTS idx_clients_backup_date ON clients_backup(backup_date DESC);
CREATE INDEX IF NOT EXISTS idx_clients_backup_original_id ON clients_backup(id);

-- 4. Trigger para backup automático de clients
CREATE OR REPLACE FUNCTION backup_client_before_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO clients_backup (
    id, closer_id, name, name_normalized, email, phone, company, niche, status,
    source, revenue, has_partner, main_difficulty, main_pain, notes, sale_notes,
    negotiation_notes, entry_value, sale_value, followup_date, contract_validity,
    is_sold, sold_at, is_from_indication, indication_source_id, is_super_hot,
    data_completed_at, incomplete_notification_sent, repitch_overdue_notification_sent,
    status_changed_at, product_offered, sdr_name, funnel_source, created_at, updated_at,
    backup_reason, backed_up_by
  ) VALUES (
    OLD.id, OLD.closer_id, OLD.name, OLD.name_normalized, OLD.email, OLD.phone, OLD.company, OLD.niche, OLD.status,
    OLD.source, OLD.revenue, OLD.has_partner, OLD.main_difficulty, OLD.main_pain, OLD.notes, OLD.sale_notes,
    OLD.negotiation_notes, OLD.entry_value, OLD.sale_value, OLD.followup_date, OLD.contract_validity,
    OLD.is_sold, OLD.sold_at, OLD.is_from_indication, OLD.indication_source_id, OLD.is_super_hot,
    OLD.data_completed_at, OLD.incomplete_notification_sent, OLD.repitch_overdue_notification_sent,
    OLD.status_changed_at, OLD.product_offered, OLD.sdr_name, OLD.funnel_source, OLD.created_at, OLD.updated_at,
    TG_OP, auth.uid()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER backup_client_trigger
BEFORE UPDATE OR DELETE ON clients
FOR EACH ROW
EXECUTE FUNCTION backup_client_before_change();

-- 5. Função para restaurar backup
CREATE OR REPLACE FUNCTION restore_call_from_backup(
  p_backup_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call_id UUID;
  v_backup RECORD;
BEGIN
  -- Verificar se usuário é admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can restore backups';
  END IF;

  -- Buscar o backup
  SELECT * INTO v_backup FROM calls_backup WHERE backup_id = p_backup_id;
  
  IF v_backup IS NULL THEN
    RAISE EXCEPTION 'Backup not found';
  END IF;

  -- Restaurar call do backup
  INSERT INTO calls (
    id, closer_id, client_id, client_name, call_date, call_time, status,
    product, transcription, content_hash, score, duration_minutes, niche,
    has_partner, main_difficulty, main_pain, consciousness_level, decision_reason,
    ai_summary, lead_classification, closer_classification, technical_analysis,
    analysis_metadata, main_errors, main_wins, loss_point, next_contact_date,
    source_file_id, google_doc_id, analyzed_at, entry_value, sale_value, notes,
    observation, company_name, merged_with_call_id, call_conclusion, created_at
  ) VALUES (
    v_backup.id, v_backup.closer_id, v_backup.client_id, v_backup.client_name,
    v_backup.call_date, v_backup.call_time, v_backup.status, v_backup.product,
    v_backup.transcription, v_backup.content_hash, v_backup.score, v_backup.duration_minutes,
    v_backup.niche, v_backup.has_partner, v_backup.main_difficulty, v_backup.main_pain,
    v_backup.consciousness_level, v_backup.decision_reason, v_backup.ai_summary,
    v_backup.lead_classification, v_backup.closer_classification, v_backup.technical_analysis,
    v_backup.analysis_metadata, v_backup.main_errors, v_backup.main_wins, v_backup.loss_point,
    v_backup.next_contact_date, v_backup.source_file_id, v_backup.google_doc_id,
    v_backup.analyzed_at, v_backup.entry_value, v_backup.sale_value, v_backup.notes,
    v_backup.observation, v_backup.company_name, v_backup.merged_with_call_id,
    v_backup.call_conclusion, v_backup.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    closer_id = EXCLUDED.closer_id,
    client_id = EXCLUDED.client_id,
    client_name = EXCLUDED.client_name,
    transcription = EXCLUDED.transcription,
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING id INTO v_call_id;

  RETURN v_call_id;
END;
$$;

-- 6. Limpeza automática de backups antigos (180 dias)
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS TABLE (deleted_calls INTEGER, deleted_clients INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_calls INTEGER;
  v_deleted_clients INTEGER;
BEGIN
  DELETE FROM calls_backup
  WHERE backup_date < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v_deleted_calls = ROW_COUNT;

  DELETE FROM clients_backup
  WHERE backup_date < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v_deleted_clients = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_calls, v_deleted_clients;
END;
$$;

-- 7. RLS para backups
ALTER TABLE calls_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all call backups" ON calls_backup
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view all client backups" ON clients_backup
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role has full access to call backups" ON calls_backup
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to client backups" ON clients_backup
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 8. Comentários
COMMENT ON TABLE calls_backup IS 'Backup automático de calls antes de update/delete';
COMMENT ON TABLE clients_backup IS 'Backup automático de clients antes de update/delete';
COMMENT ON FUNCTION restore_call_from_backup IS 'Restaura call do backup (apenas admins)';
COMMENT ON FUNCTION cleanup_old_backups IS 'Remove backups com mais de 180 dias';