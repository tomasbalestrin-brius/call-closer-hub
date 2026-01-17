-- Adicionar campo para controlar notificação de repitch atrasado
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS repitch_overdue_notification_sent BOOLEAN DEFAULT false;

-- Criar função para resetar notificação quando cliente sai do repitch
CREATE OR REPLACE FUNCTION reset_repitch_notification_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'repitch' AND NEW.status IS DISTINCT FROM 'repitch' THEN
    NEW.repitch_overdue_notification_sent = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger para executar a função
DROP TRIGGER IF EXISTS reset_repitch_notification ON clients;
CREATE TRIGGER reset_repitch_notification
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION reset_repitch_notification_on_status_change();