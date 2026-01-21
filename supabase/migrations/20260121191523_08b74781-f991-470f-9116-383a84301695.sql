-- =============================================
-- FASE 1: CORREÇÕES CRÍTICAS DE SEGURANÇA
-- =============================================

-- 1.1 CORRIGIR POLÍTICAS RLS DE PROFILES (RESTRICTIVE → PERMISSIVE)
-- =============================================

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Leaders can view squad member profiles" ON profiles;

-- Recriar como PERMISSIVE (padrão - OR lógico entre políticas)
CREATE POLICY "Users can view their own profile" ON profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Leaders can view squad member profiles" ON profiles
FOR SELECT USING (
  has_role(auth.uid(), 'lider'::user_role) AND EXISTS (
    SELECT 1 FROM squad_members sm1
    JOIN squad_members sm2 ON sm1.squad_id = sm2.squad_id
    WHERE sm1.user_id = auth.uid() AND sm2.user_id = profiles.user_id
  )
);

-- 1.2 CORRIGIR POLÍTICAS RLS DE CLIENTS
-- =============================================

DROP POLICY IF EXISTS "Closers can view their own clients" ON clients;
DROP POLICY IF EXISTS "Admins can view all clients" ON clients;
DROP POLICY IF EXISTS "Leaders can view squad member clients" ON clients;

CREATE POLICY "Closers can view their own clients" ON clients
FOR SELECT USING (auth.uid() = closer_id);

CREATE POLICY "Admins can view all clients" ON clients
FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Leaders can view squad member clients" ON clients
FOR SELECT USING (is_squad_leader_of_user(auth.uid(), closer_id));

-- 1.3 CORRIGIR POLÍTICAS RLS DE CALLS
-- =============================================

DROP POLICY IF EXISTS "Closers can view their own calls" ON calls;
DROP POLICY IF EXISTS "Admins can view all calls" ON calls;
DROP POLICY IF EXISTS "Leaders can view squad member calls" ON calls;

CREATE POLICY "Closers can view their own calls" ON calls
FOR SELECT USING (auth.uid() = closer_id);

CREATE POLICY "Admins can view all calls" ON calls
FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Leaders can view squad member calls" ON calls
FOR SELECT USING (is_squad_leader_of_user(auth.uid(), closer_id));

-- Adicionar política UPDATE para líderes (estava faltando)
CREATE POLICY "Leaders can update squad member calls" ON calls
FOR UPDATE USING (is_squad_leader_of_user(auth.uid(), closer_id));

-- 1.4 CORRIGIR POLÍTICAS RLS DE PORTFOLIO_STUDENTS
-- =============================================

DROP POLICY IF EXISTS "Closers can view their own students" ON portfolio_students;
DROP POLICY IF EXISTS "Admins can view all students" ON portfolio_students;

CREATE POLICY "Closers can view their own students" ON portfolio_students
FOR SELECT USING (auth.uid() = closer_id);

CREATE POLICY "Admins can view all students" ON portfolio_students
FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

-- Adicionar política para líderes verem alunos do squad
CREATE POLICY "Leaders can view squad member students" ON portfolio_students
FOR SELECT USING (is_squad_leader_of_user(auth.uid(), closer_id));

-- 1.5 CORRIGIR POLÍTICAS RLS DE INTENSIVE_LEADS
-- =============================================

DROP POLICY IF EXISTS "Closers can view their own leads" ON intensive_leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON intensive_leads;

CREATE POLICY "Closers can view their own leads" ON intensive_leads
FOR SELECT USING (auth.uid() = closer_id);

CREATE POLICY "Admins can view all leads" ON intensive_leads
FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

-- 1.6 CORRIGIR POLÍTICAS RLS DE INDICATIONS
-- =============================================

DROP POLICY IF EXISTS "Users can view their own indications" ON indications;
DROP POLICY IF EXISTS "Admins can view all indications" ON indications;

CREATE POLICY "Users can view their own indications" ON indications
FOR SELECT USING (auth.uid() = indicated_by);

CREATE POLICY "Admins can view all indications" ON indications
FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

-- 1.7 RESTRINGIR AUDIT LOGS (P1)
-- =============================================

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON admin_audit_logs;

-- Criar função SECURITY DEFINER para inserir logs de forma segura
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_action_type text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO admin_audit_logs (
    performed_by, action_type, entity_type, entity_id, 
    target_user_id, old_value, new_value, metadata
  ) VALUES (
    auth.uid(), p_action_type, p_entity_type, p_entity_id,
    p_target_user_id, p_old_value, p_new_value, p_metadata
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Política mais restritiva - apenas admins e líderes podem inserir diretamente
CREATE POLICY "Admins and leaders can insert audit logs" ON admin_audit_logs
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'lider'::user_role)
);

-- 1.8 CRIAR VIEW SEGURA PARA PROFILES (P0 - Proteger tokens)
-- =============================================

CREATE OR REPLACE VIEW public.profiles_safe AS
SELECT 
  id, user_id, full_name, avatar_url, phone, status,
  google_connected, google_email, closer_level,
  drive_folder_id, drive_folder_name, drive_last_sync,
  drive_auto_import, drive_import_frequency,
  drive_file_types, drive_name_patterns,
  created_at, updated_at
FROM profiles;

-- Conceder acesso à view
GRANT SELECT ON public.profiles_safe TO authenticated;

-- 1.9 ADICIONAR ÍNDICES DE PERFORMANCE (P3)
-- =============================================

CREATE INDEX IF NOT EXISTS idx_calls_closer_id ON calls(closer_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_call_date ON calls(call_date);
CREATE INDEX IF NOT EXISTS idx_calls_merged_with ON calls(merged_with_call_id) WHERE merged_with_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_closer_id ON clients(closer_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_closer_status ON clients(closer_id, status);
CREATE INDEX IF NOT EXISTS idx_portfolio_closer_id ON portfolio_students(closer_id);
CREATE INDEX IF NOT EXISTS idx_intensive_leads_closer_id ON intensive_leads(closer_id);
CREATE INDEX IF NOT EXISTS idx_intensive_leads_edition_id ON intensive_leads(edition_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_user_id ON squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id ON squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);