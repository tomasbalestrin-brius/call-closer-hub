-- Resetar arquivos com erro para reprocessamento (exceto documentos vazios)
UPDATE imported_files 
SET status = 'pending', error_message = NULL
WHERE status = 'error' 
  AND (error_message IS NULL OR error_message NOT LIKE '%vazio%');