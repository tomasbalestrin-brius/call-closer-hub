-- Adicionar campo para rastrear quando os dados foram completados
ALTER TABLE clients ADD COLUMN IF NOT EXISTS data_completed_at TIMESTAMP WITH TIME ZONE;

-- Adicionar campo para rastrear se notificação já foi enviada (evita spam)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS incomplete_notification_sent BOOLEAN DEFAULT FALSE;

-- Função para verificar se dados do cliente estão completos
CREATE OR REPLACE FUNCTION check_client_data_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Se todos os campos obrigatórios estão preenchidos e ainda não foi marcado como completo
  IF NEW.phone IS NOT NULL 
     AND NEW.phone != ''
     AND NEW.revenue IS NOT NULL 
     AND NEW.product_offered IS NOT NULL 
     AND NEW.product_offered != ''
     AND OLD.data_completed_at IS NULL THEN
    NEW.data_completed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para detectar preenchimento
DROP TRIGGER IF EXISTS trigger_check_client_completion ON clients;
CREATE TRIGGER trigger_check_client_completion
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION check_client_data_completion();

-- Função SECURITY DEFINER para criar notificações (contorna RLS)
CREATE OR REPLACE FUNCTION create_client_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'alert'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (p_user_id, p_title, p_message, p_type)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Função para buscar o líder do squad de um closer
CREATE OR REPLACE FUNCTION get_squad_leader_for_closer(p_closer_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader_id UUID;
BEGIN
  -- Buscar o líder do squad onde o closer está
  SELECT ur.user_id INTO v_leader_id
  FROM squad_members sm
  JOIN squad_members sm_leader ON sm.squad_id = sm_leader.squad_id
  JOIN user_roles ur ON sm_leader.user_id = ur.user_id
  WHERE sm.user_id = p_closer_id
    AND ur.role = 'lider'
  LIMIT 1;
  
  RETURN v_leader_id;
END;
$$;