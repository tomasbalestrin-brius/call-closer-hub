-- Função para mapear product_offered para ticket_type
CREATE OR REPLACE FUNCTION public.map_product_to_ticket(product_offered text)
RETURNS public.ticket_type
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN CASE
    -- Tickets 29.90
    WHEN product_offered ILIKE '%intensivo%' THEN '29_90'::public.ticket_type
    WHEN product_offered ILIKE '%bethel club%' THEN '29_90'::public.ticket_type
    
    -- Tickets 12k
    WHEN product_offered ILIKE '%implementação comercial%' THEN '12k'::public.ticket_type
    WHEN product_offered ILIKE '%implementacao comercial%' THEN '12k'::public.ticket_type
    WHEN product_offered ILIKE '%mentoria premium%' THEN '12k'::public.ticket_type
    WHEN product_offered ILIKE '%implementação de ia%' THEN '12k'::public.ticket_type
    WHEN product_offered ILIKE '%implementacao de ia%' THEN '12k'::public.ticket_type
    WHEN product_offered ILIKE '%nexttrack%' THEN '12k'::public.ticket_type
    
    -- Tickets 80k
    WHEN product_offered ILIKE '%elite%' THEN '80k'::public.ticket_type
    WHEN product_offered ILIKE '%80k%' THEN '80k'::public.ticket_type
    
    -- Default
    ELSE '29_90'::public.ticket_type
  END;
END;
$$;

-- Função para migrar cliente para portfolio
CREATE OR REPLACE FUNCTION public.migrate_client_to_portfolio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só executa se o status mudou para pos_21_carterizacao
  IF NEW.status = 'pos_21_carterizacao' AND (OLD.status IS DISTINCT FROM 'pos_21_carterizacao') THEN
    -- Verifica se já não existe no portfolio
    IF NOT EXISTS (SELECT 1 FROM portfolio_students WHERE client_id = NEW.id) THEN
      -- Insere no portfolio_students
      INSERT INTO portfolio_students (
        client_id,
        closer_id,
        name,
        phone,
        email,
        niche,
        notes,
        current_ticket,
        entry_date
      ) VALUES (
        NEW.id,
        NEW.closer_id,
        NEW.name,
        NEW.phone,
        NEW.email,
        NEW.niche,
        NEW.notes,
        map_product_to_ticket(NEW.product_offered),
        COALESCE(NEW.status_changed_at::date, CURRENT_DATE)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para migração automática
DROP TRIGGER IF EXISTS on_client_status_to_portfolio ON clients;
CREATE TRIGGER on_client_status_to_portfolio
  AFTER UPDATE OF status ON clients
  FOR EACH ROW
  EXECUTE FUNCTION migrate_client_to_portfolio();

-- Migrar clientes existentes que já estão em pos_21_carterizacao
INSERT INTO portfolio_students (client_id, closer_id, name, phone, email, niche, notes, current_ticket, entry_date)
SELECT 
  c.id,
  c.closer_id,
  c.name,
  c.phone,
  c.email,
  c.niche,
  c.notes,
  map_product_to_ticket(c.product_offered),
  COALESCE(c.status_changed_at::date, c.created_at::date)
FROM clients c
WHERE c.status = 'pos_21_carterizacao'
AND c.id NOT IN (SELECT ps.client_id FROM portfolio_students ps WHERE ps.client_id IS NOT NULL);