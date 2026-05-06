CREATE OR REPLACE FUNCTION public.copy_client_to_intensive_leads()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_intensivo_user_id uuid;
  v_edition_id uuid;
BEGIN
  IF NEW.status = 'pos_call_16_21' AND (OLD.status IS DISTINCT FROM 'pos_call_16_21') THEN
    SELECT user_id INTO v_intensivo_user_id
    FROM user_roles WHERE role = 'intensivo' LIMIT 1;
    IF v_intensivo_user_id IS NULL THEN RETURN NEW; END IF;

    SELECT id INTO v_edition_id
    FROM intensive_editions
    WHERE is_active = true
    ORDER BY event_date ASC NULLS LAST
    LIMIT 1;
    IF v_edition_id IS NULL THEN RETURN NEW; END IF;

    IF EXISTS (
      SELECT 1 FROM intensive_leads
      WHERE source_client_id = NEW.id AND edition_id = v_edition_id
    ) THEN RETURN NEW; END IF;

    INSERT INTO intensive_leads (
      edition_id, closer_id, name, phone, email, company, niche,
      status, source, source_client_id, lead_temperature
    ) VALUES (
      v_edition_id, v_intensivo_user_id, NEW.name, NEW.phone, NEW.email, NEW.company, NEW.niche,
      'abordagem_inicial', 'crm_calls', NEW.id, 'morno'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_client_to_intensive_leads ON public.clients;
CREATE TRIGGER trg_copy_client_to_intensive_leads
AFTER UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.copy_client_to_intensive_leads();