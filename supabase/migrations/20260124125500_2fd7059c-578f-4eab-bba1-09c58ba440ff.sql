-- Corrigir tipo da coluna contract_validity na tabela de backup
-- A tabela clients usa TEXT, mas clients_backup usava DATE, causando falha no trigger de backup
ALTER TABLE clients_backup 
ALTER COLUMN contract_validity TYPE TEXT 
USING contract_validity::TEXT;

-- Comentário explicativo para documentação
COMMENT ON COLUMN clients_backup.contract_validity IS 'Vigência do contrato em formato texto livre (ex: 12 meses, 1 ano)';