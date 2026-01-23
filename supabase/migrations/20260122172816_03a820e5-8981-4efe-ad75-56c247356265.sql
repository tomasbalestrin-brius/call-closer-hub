-- ============================================================================
-- MIGRATION: Fase 1 - Correções Críticas (Hash, Lock Atômico, Normalização)
-- ============================================================================

-- ========== 1. DEDUPLICAÇÃO POR HASH DE CONTEÚDO ==========

-- Adicionar coluna content_hash para deduplicação
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Adicionar metadados de análise
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS analysis_metadata JSONB DEFAULT '{}'::jsonb;

-- Índice para busca rápida por hash
CREATE INDEX IF NOT EXISTS idx_calls_content_hash
ON calls(content_hash)
WHERE content_hash IS NOT NULL;

-- Índice composto único para deduplicação (closer + hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_closer_hash
ON calls(closer_id, content_hash)
WHERE content_hash IS NOT NULL;

-- Índice GIN para queries em metadados
CREATE INDEX IF NOT EXISTS idx_calls_analysis_metadata
ON calls USING GIN (analysis_metadata);

-- Comentários de documentação
COMMENT ON COLUMN calls.content_hash IS 'SHA-256 hash da transcrição para deduplicação';
COMMENT ON COLUMN calls.analysis_metadata IS 'Metadados: is_partial, chunks_analyzed, confidence_level';

-- ========== 2. LOCK ATÔMICO PARA PROCESSAMENTO ==========

-- Adicionar coluna retry_count
ALTER TABLE imported_files
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Função para claim atômico de arquivos pendentes
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE imported_files
  SET
    status = 'processing',
    started_processing_at = NOW(),
    error_message = NULL
  WHERE imported_files.id IN (
    SELECT sub.id
    FROM imported_files sub
    WHERE sub.user_id = p_user_id
      AND sub.status = 'pending'
    ORDER BY sub.created_at ASC
    LIMIT p_max_files
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    imported_files.id,
    imported_files.drive_file_id,
    imported_files.file_name;
END;
$$;

-- Função para incrementar retry
CREATE OR REPLACE FUNCTION increment_file_retry(p_file_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE imported_files
  SET retry_count = COALESCE(retry_count, 0) + 1
  WHERE id = p_file_id;
END;
$$;

-- Comentários
COMMENT ON FUNCTION claim_pending_files IS 'Claim atômico com SKIP LOCKED para prevenir race conditions';
COMMENT ON COLUMN imported_files.retry_count IS 'Número de tentativas de processamento';

-- ========== 3. NORMALIZAÇÃO DE NOMES DE CLIENTES ==========

-- Extensão unaccent para remover acentos
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Função de normalização de nomes
CREATE OR REPLACE FUNCTION normalize_client_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF name IS NULL OR TRIM(name) = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN LOWER(
    TRIM(
      REGEXP_REPLACE(
        UNACCENT(name),
        '\s+', ' ',
        'g'
      )
    )
  );
END;
$$;

-- Coluna gerada automaticamente (computed column)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS name_normalized TEXT
GENERATED ALWAYS AS (normalize_client_name(name)) STORED;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_clients_name_normalized
ON clients(closer_id, name_normalized)
WHERE name_normalized IS NOT NULL;

-- Comentários
COMMENT ON FUNCTION normalize_client_name IS 'Normaliza: remove acentos, lowercase, trim espaços';
COMMENT ON COLUMN clients.name_normalized IS 'Nome normalizado para deduplicação (auto-gerado)';