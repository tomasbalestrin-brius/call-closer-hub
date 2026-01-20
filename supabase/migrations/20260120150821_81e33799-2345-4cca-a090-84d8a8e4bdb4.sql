-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Bloquear acesso não autenticado
-- =====================================================

-- As políticas atuais permitem queries sem auth.uid() IS NOT NULL
-- Vamos atualizar as políticas SELECT para exigir autenticação

-- 1. PROFILES - Dados sensíveis (tokens OAuth, emails)
-- Já tem políticas específicas, mas precisamos garantir que todas exigem auth
-- As políticas atuais já usam auth.uid() em suas condições, então estão OK

-- 2. USER_ROLES - Adicionar restrição de autenticação
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 3. DAILY_VERSES - Esta é pública intencionalmente (Anyone can read verses)
-- Mantemos como está pois são versículos públicos

-- 4. SQUADS - Corrigir política de líderes (bug no JOIN)
DROP POLICY IF EXISTS "Leaders view their squads" ON squads;
CREATE POLICY "Leaders view their squads" ON squads
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM squad_members
    WHERE squad_members.squad_id = squads.id 
    AND squad_members.user_id = auth.uid()
  )
);

-- 5. NOTIFICATIONS - Garantir autenticação
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 6. CRM_AUTOMATIONS - Garantir autenticação
DROP POLICY IF EXISTS "Users can manage their own automations" ON crm_automations;
CREATE POLICY "Users can manage their own automations" ON crm_automations
FOR ALL USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 7. CRM_COLUMN_SETTINGS - Garantir autenticação
DROP POLICY IF EXISTS "Users can manage their own column settings" ON crm_column_settings;
CREATE POLICY "Users can manage their own column settings" ON crm_column_settings
FOR ALL USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 8. CLIENT_TAGS - Garantir autenticação
DROP POLICY IF EXISTS "Users can manage their own tags" ON client_tags;
CREATE POLICY "Users can manage their own tags" ON client_tags
FOR ALL USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 9. CLIENT_TAG_ASSIGNMENTS - Garantir autenticação
DROP POLICY IF EXISTS "Users can manage tag assignments for their clients" ON client_tag_assignments;
CREATE POLICY "Users can manage tag assignments for their clients" ON client_tag_assignments
FOR ALL USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_tag_assignments.client_id 
    AND clients.closer_id = auth.uid()
  )
);

-- 10. MONTHLY_GOALS - Garantir autenticação nas políticas
DROP POLICY IF EXISTS "Closers can view their own goals" ON monthly_goals;
CREATE POLICY "Closers can view their own goals" ON monthly_goals
FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = closer_id);

-- 11. IMPORT_PROGRESS - Garantir autenticação
DROP POLICY IF EXISTS "Admins can view import progress" ON import_progress;
CREATE POLICY "Admins can view import progress" ON import_progress
FOR SELECT USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "Leaders can view import progress" ON import_progress;
CREATE POLICY "Leaders can view import progress" ON import_progress
FOR SELECT USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'lider'::user_role));

DROP POLICY IF EXISTS "Admins can manage import progress" ON import_progress;
CREATE POLICY "Admins can manage import progress" ON import_progress
FOR ALL USING (auth.uid() IS NOT NULL AND has_role(auth.uid(), 'admin'::user_role));