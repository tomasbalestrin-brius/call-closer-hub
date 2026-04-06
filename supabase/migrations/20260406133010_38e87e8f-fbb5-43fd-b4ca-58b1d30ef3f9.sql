
-- 1. Add 'intensivo' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'intensivo';

-- 2. Add origin_closer_name column to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS origin_closer_name text;

-- 3. Add origin_closer_name to clients_backup for consistency
ALTER TABLE public.clients_backup ADD COLUMN IF NOT EXISTS origin_closer_name text;

-- 4. Create trigger function to copy client to intensivo user
CREATE OR REPLACE FUNCTION public.copy_client_to_intensivo_carlos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_intensivo_user_id UUID;
  v_closer_name TEXT;
BEGIN
  -- Only fire when status changes TO 'intensivo_carlos'
  IF NEW.status = 'intensivo_carlos' AND (OLD.status IS DISTINCT FROM 'intensivo_carlos') THEN
    -- Find the user with role 'intensivo'
    SELECT ur.user_id INTO v_intensivo_user_id
    FROM user_roles ur
    WHERE ur.role = 'intensivo'
    LIMIT 1;

    IF v_intensivo_user_id IS NULL THEN
      RAISE LOG 'No user with intensivo role found, skipping copy';
      RETURN NEW;
    END IF;

    -- Get the closer name from profiles
    SELECT p.full_name INTO v_closer_name
    FROM profiles p
    WHERE p.user_id = OLD.closer_id
    LIMIT 1;

    -- Copy the client to intensivo user's CRM
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
$$;

-- 5. Create the trigger
DROP TRIGGER IF EXISTS trigger_copy_client_to_intensivo ON public.clients;
CREATE TRIGGER trigger_copy_client_to_intensivo
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.copy_client_to_intensivo_carlos();
