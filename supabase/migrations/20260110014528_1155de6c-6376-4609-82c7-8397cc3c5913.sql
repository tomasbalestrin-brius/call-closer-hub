-- Sistema de Tags Customizáveis
CREATE TABLE client_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  icon text DEFAULT 'tag',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE client_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tags"
  ON client_tags FOR ALL USING (auth.uid() = user_id);

-- Associação Tag-Cliente
CREATE TABLE client_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES client_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(client_id, tag_id)
);

ALTER TABLE client_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tag assignments for their clients"
  ON client_tag_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = client_id AND clients.closer_id = auth.uid()
  ));

-- Configurações de Colunas do Kanban
CREATE TABLE crm_column_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  column_id text NOT NULL,
  custom_title text,
  custom_subtitle text,
  custom_color text,
  display_order int,
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, column_id)
);

ALTER TABLE crm_column_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own column settings"
  ON crm_column_settings FOR ALL USING (auth.uid() = user_id);

-- Sistema de Automações
CREATE TABLE crm_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}',
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE crm_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own automations"
  ON crm_automations FOR ALL USING (auth.uid() = user_id);

-- Tabela para log de execuções de automações
CREATE TABLE automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES crm_automations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  executed_at timestamptz DEFAULT now(),
  result jsonb,
  UNIQUE(automation_id, client_id, executed_at)
);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their automation logs"
  ON automation_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM crm_automations WHERE crm_automations.id = automation_id AND crm_automations.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their automation logs"
  ON automation_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM crm_automations WHERE crm_automations.id = automation_id AND crm_automations.user_id = auth.uid()
  ));

-- Adicionar coluna status_changed_at para tracking de tempo em cada coluna
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status_changed_at timestamptz DEFAULT now();

-- Trigger para atualizar status_changed_at quando status muda
CREATE OR REPLACE FUNCTION update_client_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER client_status_changed
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_client_status_changed_at();