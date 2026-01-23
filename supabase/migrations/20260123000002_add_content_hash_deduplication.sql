-- ============================================================================
-- CRITICAL FIX 2: Deduplicação por hash de conteúdo
-- ============================================================================

-- 1. Adicionar coluna content_hash
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 2. Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_calls_content_hash
ON calls(content_hash)
WHERE content_hash IS NOT NULL;

-- 3. Criar índice único composto (previne duplicatas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_closer_content_hash
ON calls(closer_id, content_hash)
WHERE content_hash IS NOT NULL;

-- 4. Comentário
COMMENT ON COLUMN calls.content_hash IS
  'SHA-256 hash da transcrição para deduplicação de conteúdo';

-- 5. Popular hash para calls existentes (opcional - COMENTADO pois pode demorar muito)
-- DESCOMENTAR APENAS SE QUISER PROCESSAR CALLS ANTIGAS:
-- UPDATE calls
-- SET content_hash = encode(digest(transcription, 'sha256'), 'hex')
-- WHERE content_hash IS NULL AND transcription IS NOT NULL;
