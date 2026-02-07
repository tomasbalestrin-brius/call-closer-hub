-- Migrar erros existentes de "Call muito curta" para system_logs
INSERT INTO system_logs (level, service, user_id, operation, error_message, metadata)
SELECT 
  'warning', 
  'import-and-analyze', 
  user_id, 
  'quality_rejection',
  error_message,
  jsonb_build_object(
    'file_name', file_name,
    'drive_file_id', drive_file_id,
    'reason', 'call_muito_curta',
    'migrated', true
  )
FROM imported_files
WHERE error_message LIKE '%Call muito curta%';

-- Migrar erros de conteúdo inválido/corrompido
INSERT INTO system_logs (level, service, user_id, operation, error_message, metadata)
SELECT 
  'warning', 
  'import-and-analyze', 
  user_id, 
  'quality_rejection',
  error_message,
  jsonb_build_object(
    'file_name', file_name,
    'drive_file_id', drive_file_id,
    'reason', 'conteudo_invalido',
    'migrated', true
  )
FROM imported_files
WHERE error_message LIKE '%Conteúdo inválido%';

-- Deletar registros de erro migrados
DELETE FROM imported_files
WHERE error_message LIKE '%Call muito curta%'
   OR error_message LIKE '%Conteúdo inválido%';
