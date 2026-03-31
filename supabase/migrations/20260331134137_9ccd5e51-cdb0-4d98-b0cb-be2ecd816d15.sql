
-- Enable pg_net extension for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that fires the webhook via pg_net
CREATE OR REPLACE FUNCTION public.notify_sale_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url TEXT;
  v_anon_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Only fire when is_sold changes to true
  IF NEW.is_sold = true AND (OLD.is_sold IS DISTINCT FROM true) THEN
    -- Get Supabase URL from environment
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_anon_key := current_setting('app.settings.anon_key', true);
    
    -- If settings not available, use hardcoded project URL
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      v_supabase_url := 'https://eevsyfgtlumaaslgeyib.supabase.co';
    END IF;
    
    IF v_anon_key IS NULL OR v_anon_key = '' THEN
      v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVldnN5Zmd0bHVtYWFzbGdleWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTkyNTEsImV4cCI6MjA4MzE5NTI1MX0.uA8AJtvQQ4lz3rlUUYH0Xi3wvPNm8TEfFvUZBaAWoTE';
    END IF;

    -- Fire async HTTP request to the edge function
    SELECT extensions.http_post(
      url := v_supabase_url || '/functions/v1/send-sale-webhook',
      body := jsonb_build_object('client_id', NEW.id)::text,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon_key,
        'Authorization', 'Bearer ' || v_anon_key
      )::text
    ) INTO v_request_id;

    RAISE LOG 'Sale webhook triggered for client %, request_id: %', NEW.id, v_request_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on the clients table
CREATE TRIGGER trigger_sale_webhook
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sale_webhook();
