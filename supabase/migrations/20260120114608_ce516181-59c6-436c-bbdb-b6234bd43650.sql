-- Resetar arquivos com erro de rate limit para reprocessamento
UPDATE imported_files 
SET status = 'pending', error_message = NULL
WHERE status = 'error' 
  AND error_message = 'Rate limit exceeded. Please try again later.';