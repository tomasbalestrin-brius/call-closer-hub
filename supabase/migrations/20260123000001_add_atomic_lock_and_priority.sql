-- ============================================================================
-- CRITICAL FIX 1: Lock atômico com FOR UPDATE SKIP LOCKED
-- ============================================================================

-- 1. Adicionar colunas para retry e prioridade
ALTER TABLE imported_files
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10);

-- 2. Criar índice para ordenação eficiente
CREATE INDEX IF NOT EXISTS idx_imported_files_claim_order
ON imported_files(user_id, status, priority DESC, created_at ASC)
WHERE status = 'pending';

-- 3. Função para claim atômico de arquivos pendentes
CREATE OR REPLACE FUNCTION claim_pending_files(
  p_user_id UUID,
  p_max_files INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  drive_file_id TEXT,
  file_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update e select em uma única transação atômica
  RETURN QUERY
  UPDATE imported_files
  SET
    status = 'processing',
    started_processing_at = NOW(),
    error_message = NULL
  WHERE imported_files.id IN (
    SELECT imported_files.id
    FROM imported_files
    WHERE imported_files.user_id = p_user_id
      AND imported_files.status = 'pending'
    ORDER BY
      imported_files.priority DESC,    -- Alta prioridade primeiro
      imported_files.retry_count ASC,  -- Menos retries primeiro
      imported_files.created_at ASC    -- Mais antigos primeiro (FIFO)
    LIMIT p_max_files
    FOR UPDATE SKIP LOCKED  -- ← CRÍTICO: Pula se outro processo já pegou
  )
  RETURNING
    imported_files.id,
    imported_files.drive_file_id,
    imported_files.file_name;
END;
$$;

-- 4. Função para incrementar contador de retry
CREATE OR REPLACE FUNCTION increment_file_retry(
  p_file_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE imported_files
  SET retry_count = COALESCE(retry_count, 0) + 1
  WHERE id = p_file_id;
END;
$$;

-- 5. Comentários
COMMENT ON FUNCTION claim_pending_files IS
  'Claim atômico de arquivos pendentes com SKIP LOCKED para prevenir race conditions';
COMMENT ON FUNCTION increment_file_retry IS
  'Incrementa contador de tentativas de processamento';
COMMENT ON COLUMN imported_files.retry_count IS
  'Número de tentativas de processamento';
COMMENT ON COLUMN imported_files.priority IS
  'Prioridade de processamento (1-10, 10=máxima urgência)';
