-- Criar enum para classificação do lead
CREATE TYPE public.lead_classification AS ENUM ('pos_venda', 'follow');

-- Criar enum para classificação do closer
CREATE TYPE public.closer_classification AS ENUM ('iniciante', 'intermediario', 'avancado', 'alta_performance', 'elite');

-- Criar enum para status de importação
CREATE TYPE public.import_status AS ENUM ('pending', 'processing', 'completed', 'error');

-- Criar enum para fonte do cliente
CREATE TYPE public.client_source AS ENUM ('manual', 'google_drive');

-- Criar enum para frequência de importação
CREATE TYPE public.import_frequency AS ENUM ('manual', 'hourly', 'daily', 'realtime');

-- Expandir tabela profiles com configurações do Drive
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS drive_folder_id text,
ADD COLUMN IF NOT EXISTS drive_folder_name text,
ADD COLUMN IF NOT EXISTS drive_file_types jsonb DEFAULT '["google-docs"]'::jsonb,
ADD COLUMN IF NOT EXISTS drive_name_patterns jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS drive_auto_import boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS drive_import_frequency import_frequency DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS drive_last_sync timestamp with time zone;

-- Expandir tabela calls com campos de análise IA
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS niche text,
ADD COLUMN IF NOT EXISTS has_partner boolean,
ADD COLUMN IF NOT EXISTS main_difficulty text,
ADD COLUMN IF NOT EXISTS main_pain text,
ADD COLUMN IF NOT EXISTS consciousness_level text,
ADD COLUMN IF NOT EXISTS decision_reason text,
ADD COLUMN IF NOT EXISTS ai_summary text,
ADD COLUMN IF NOT EXISTS lead_classification lead_classification,
ADD COLUMN IF NOT EXISTS closer_classification closer_classification,
ADD COLUMN IF NOT EXISTS technical_analysis jsonb,
ADD COLUMN IF NOT EXISTS main_errors text[],
ADD COLUMN IF NOT EXISTS main_wins text[],
ADD COLUMN IF NOT EXISTS loss_point text,
ADD COLUMN IF NOT EXISTS next_contact_date date,
ADD COLUMN IF NOT EXISTS source_file_id text,
ADD COLUMN IF NOT EXISTS analyzed_at timestamp with time zone;

-- Expandir tabela clients com dados extraídos
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS niche text,
ADD COLUMN IF NOT EXISTS has_partner boolean,
ADD COLUMN IF NOT EXISTS main_difficulty text,
ADD COLUMN IF NOT EXISTS main_pain text,
ADD COLUMN IF NOT EXISTS source client_source DEFAULT 'manual';

-- Criar tabela imported_files para rastreamento
CREATE TABLE public.imported_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  status import_status NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, drive_file_id)
);

-- Habilitar RLS na tabela imported_files
ALTER TABLE public.imported_files ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para imported_files
CREATE POLICY "Users can view their own imported files"
ON public.imported_files
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own imported files"
ON public.imported_files
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imported files"
ON public.imported_files
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported files"
ON public.imported_files
FOR DELETE
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_imported_files_user_id ON public.imported_files(user_id);
CREATE INDEX IF NOT EXISTS idx_imported_files_drive_file_id ON public.imported_files(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_imported_files_status ON public.imported_files(status);
CREATE INDEX IF NOT EXISTS idx_calls_source_file_id ON public.calls(source_file_id);
CREATE INDEX IF NOT EXISTS idx_calls_lead_classification ON public.calls(lead_classification);
CREATE INDEX IF NOT EXISTS idx_calls_next_contact_date ON public.calls(next_contact_date);