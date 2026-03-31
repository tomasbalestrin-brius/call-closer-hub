
-- Limpar TODOS os imported_files pendentes do Deyvison (serão reimportados com critério correto)
DELETE FROM imported_files 
WHERE user_id = '94e25a6d-8016-4b4c-b842-e8fefe0435f9' 
  AND status = 'pending';

-- Atualizar drive_last_sync para 17/03/2026 para que reimportação só traga arquivos dessa data em diante
UPDATE profiles 
SET drive_last_sync = '2026-03-17T00:00:00.000Z' 
WHERE user_id = '94e25a6d-8016-4b4c-b842-e8fefe0435f9';
