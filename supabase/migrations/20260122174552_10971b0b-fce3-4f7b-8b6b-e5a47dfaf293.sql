-- Recriar triggers de backup (podem não ter sido aplicados)
DROP TRIGGER IF EXISTS backup_call_trigger ON calls;
DROP TRIGGER IF EXISTS backup_client_trigger ON clients;

CREATE TRIGGER backup_call_trigger
BEFORE UPDATE OR DELETE ON calls
FOR EACH ROW
EXECUTE FUNCTION backup_call_before_change();

CREATE TRIGGER backup_client_trigger
BEFORE UPDATE OR DELETE ON clients
FOR EACH ROW
EXECUTE FUNCTION backup_client_before_change();