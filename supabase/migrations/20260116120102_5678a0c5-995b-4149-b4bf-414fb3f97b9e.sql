-- Drop the old constraint and add a new one that allows score 0
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_score_check;
ALTER TABLE public.calls ADD CONSTRAINT calls_score_check CHECK (score >= 0 AND score <= 10);

-- Also reset any stuck "processing" files to "error" so they can be reprocessed
UPDATE public.imported_files 
SET status = 'error', 
    error_message = 'Processamento interrompido - será reprocessado automaticamente'
WHERE status = 'processing' 
  AND imported_at < NOW() - INTERVAL '30 minutes';