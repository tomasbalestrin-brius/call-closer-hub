
CREATE OR REPLACE FUNCTION public.copy_client_to_carlos_on_8_15()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_intensivo_user_id uuid;
  v_closer_name text;
BEGIN
  IF NEW.status = 'pos_call_8_15' AND (OLD.status IS DISTINCT FROM 'pos_call_8_15') THEN
    -- find intensivo user (Carlos)
    SELECT ur.user_id INTO v_intensivo_user_id
    FROM user_roles ur
    WHERE ur.role = 'intensivo'
    LIMIT 1;

    IF v_intensivo_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- don't duplicate if Carlos already has a client with same name and phone
    IF EXISTS (
      SELECT 1 FROM clients
      WHERE closer_id = v_intensivo_user_id
        AND name_normalized = normalize_client_name(NEW.name)
        AND COALESCE(phone, '') = COALESCE(NEW.phone, '')
    ) THEN
      RETURN NEW;
    END IF;

    SELECT p.full_name INTO v_closer_name
    FROM profiles p
    WHERE p.user_id = NEW.closer_id
    LIMIT 1;

    INSERT INTO clients (
      closer_id, name, email, phone, company, niche,
      source, revenue, has_partner, main_difficulty, main_pain,
      notes, product_offered, sdr_name, funnel_source, instagram,
      status, origin_closer_name
    ) VALUES (
      v_intensivo_user_id, NEW.name, NEW.email, NEW.phone, NEW.company, NEW.niche,
      NEW.source, NEW.revenue, NEW.has_partner, NEW.main_difficulty, NEW.main_pain,
      NEW.notes, NEW.product_offered, NEW.sdr_name, NEW.funnel_source, NEW.instagram,
      'enviar_convite_intensivo', COALESCE(v_closer_name, 'Desconhecido')
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_copy_client_to_carlos_8_15 ON public.clients;
CREATE TRIGGER trg_copy_client_to_carlos_8_15
AFTER UPDATE OF status ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.copy_client_to_carlos_on_8_15();
