
-- Tabela para rastrear custos de API
CREATE TABLE public.api_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL,
  operation TEXT,
  tokens_input BIGINT NOT NULL DEFAULT 0,
  tokens_output BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC NOT NULL DEFAULT 0,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  file_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para queries por periodo
CREATE INDEX idx_api_costs_created_at ON public.api_costs(created_at DESC);
CREATE INDEX idx_api_costs_user_id ON public.api_costs(user_id);

-- Enable RLS
ALTER TABLE public.api_costs ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem visualizar
CREATE POLICY "Admins can view all api costs"
ON public.api_costs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- RPC para inserir custos (chamada pelas edge functions via service role)
CREATE OR REPLACE FUNCTION public.log_api_cost(
  p_user_id UUID,
  p_service TEXT DEFAULT 'openai',
  p_model TEXT DEFAULT 'gpt-4o',
  p_operation TEXT DEFAULT NULL,
  p_tokens_input BIGINT DEFAULT 0,
  p_tokens_output BIGINT DEFAULT 0,
  p_call_id UUID DEFAULT NULL,
  p_file_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cost NUMERIC;
  v_id UUID;
BEGIN
  -- Calcular custo estimado baseado no modelo
  v_cost := CASE p_model
    WHEN 'gpt-4o' THEN (p_tokens_input * 2.5 + p_tokens_output * 10.0) / 1000000
    WHEN 'gpt-4o-mini' THEN (p_tokens_input * 0.15 + p_tokens_output * 0.6) / 1000000
    ELSE (p_tokens_input * 1.0 + p_tokens_output * 3.0) / 1000000
  END;

  INSERT INTO public.api_costs (
    user_id, service, model, operation,
    tokens_input, tokens_output, estimated_cost_usd,
    call_id, file_id
  ) VALUES (
    p_user_id, p_service, p_model, p_operation,
    p_tokens_input, p_tokens_output, v_cost,
    p_call_id, p_file_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
