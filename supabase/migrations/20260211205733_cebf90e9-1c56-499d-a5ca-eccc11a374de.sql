
ALTER TABLE public.intensive_leads 
ADD COLUMN lead_temperature text NOT NULL DEFAULT 'morno';

CREATE OR REPLACE FUNCTION public.validate_lead_temperature()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_temperature NOT IN ('quente', 'morno', 'frio') THEN
    RAISE EXCEPTION 'lead_temperature must be quente, morno or frio';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_lead_temperature
BEFORE INSERT OR UPDATE ON public.intensive_leads
FOR EACH ROW EXECUTE FUNCTION public.validate_lead_temperature();
