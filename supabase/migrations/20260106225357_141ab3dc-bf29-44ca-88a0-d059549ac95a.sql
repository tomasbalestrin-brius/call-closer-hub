-- Add client status for Kanban stages
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status text DEFAULT 'call_realizada';

-- Add comment for documentation
COMMENT ON COLUMN public.clients.status IS 'Kanban status: call_realizada, contato_agendado, encaminhado_fechamento, venda_realizada';