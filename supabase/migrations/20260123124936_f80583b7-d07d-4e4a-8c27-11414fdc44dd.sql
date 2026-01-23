-- Adicionar colunas faltantes à tabela calls para alinhar com a interface Call
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS analysis_quality_score NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN calls.analysis_quality_score IS 'Score de qualidade da análise AI (0-100)';
COMMENT ON COLUMN calls.deleted_at IS 'Soft delete timestamp';
COMMENT ON COLUMN calls.deleted_by IS 'ID do usuário que deletou a call';

-- Criar índice parcial para otimizar queries que filtram por deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_calls_deleted_at 
ON calls(deleted_at) WHERE deleted_at IS NULL;