
-- Create trigger to auto-copy clients in column 7 (pos_call_16_21) to intensive_leads
DROP TRIGGER IF EXISTS trg_copy_client_to_intensive_leads ON public.clients;
CREATE TRIGGER trg_copy_client_to_intensive_leads
AFTER UPDATE OF status ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.copy_client_to_intensive_leads();

-- Backfill existing clients currently in pos_call_16_21
DO $$
DECLARE
  v_intensivo_user_id uuid;
  v_edition_id uuid;
  r RECORD;
BEGIN
  SELECT user_id INTO v_intensivo_user_id
  FROM user_roles WHERE role = 'intensivo' LIMIT 1;
  IF v_intensivo_user_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_edition_id
  FROM intensive_editions
  WHERE is_active = true
  ORDER BY event_date ASC NULLS LAST
  LIMIT 1;
  IF v_edition_id IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT c.* FROM clients c
    WHERE c.status = 'pos_call_16_21'
      AND NOT EXISTS (
        SELECT 1 FROM intensive_leads il
        WHERE il.source_client_id = c.id AND il.edition_id = v_edition_id
      )
  LOOP
    INSERT INTO intensive_leads (
      edition_id, closer_id, name, phone, email, company, niche,
      status, source, source_client_id, lead_temperature
    ) VALUES (
      v_edition_id, v_intensivo_user_id, r.name, r.phone, r.email, r.company, r.niche,
      'abordagem_inicial', 'crm_calls', r.id, 'morno'
    );
  END LOOP;
END $$;
