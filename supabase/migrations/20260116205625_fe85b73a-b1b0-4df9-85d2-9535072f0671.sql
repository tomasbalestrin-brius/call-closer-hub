-- Tabela para rastrear progresso de processamento em batch
CREATE TABLE IF NOT EXISTS import_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  total_files INT NOT NULL DEFAULT 0,
  processed_files INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  current_file_name TEXT,
  current_closer_name TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar Realtime para esta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE import_progress;

-- RLS para admins e líderes
ALTER TABLE import_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view import progress"
  ON import_progress FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can manage import progress"
  ON import_progress FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Líderes também podem visualizar
CREATE POLICY "Leaders can view import progress"
  ON import_progress FOR SELECT
  USING (has_role(auth.uid(), 'lider'::user_role));