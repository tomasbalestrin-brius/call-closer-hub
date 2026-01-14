-- Atualizar a função migrate_client_to_portfolio para usar lógica baseada em venda
CREATE OR REPLACE FUNCTION public.migrate_client_to_portfolio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só executa se o status mudou para pos_21_carterizacao
  IF NEW.status = 'pos_21_carterizacao' AND (OLD.status IS DISTINCT FROM 'pos_21_carterizacao') THEN
    -- Verifica se já não existe no portfolio
    IF NOT EXISTS (SELECT 1 FROM portfolio_students WHERE client_id = NEW.id) THEN
      -- Insere no portfolio_students
      -- Ticket é determinado pela venda: se vendeu, usa sale_value para determinar; se não, 29_90
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
        CASE
          WHEN NEW.is_sold = true AND NEW.sale_value >= 50000 THEN '80k'::public.ticket_type
          WHEN NEW.is_sold = true AND NEW.sale_value >= 5000 THEN '12k'::public.ticket_type
          ELSE '29_90'::public.ticket_type  -- Padrão: ainda não comprou
        END,
        COALESCE(NEW.status_changed_at::date, CURRENT_DATE)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar função para atualizar ticket quando venda é realizada
CREATE OR REPLACE FUNCTION public.update_portfolio_ticket_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só executa se is_sold mudou para true
  IF NEW.is_sold = true AND (OLD.is_sold IS DISTINCT FROM true) THEN
    -- Atualiza o ticket do aluno na carteira
    UPDATE portfolio_students
    SET current_ticket = CASE
      WHEN NEW.sale_value >= 50000 THEN '80k'::public.ticket_type
      WHEN NEW.sale_value >= 5000 THEN '12k'::public.ticket_type
      ELSE '29_90'::public.ticket_type
    END,
    updated_at = now()
    WHERE client_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para atualizar ticket quando venda é realizada
DROP TRIGGER IF EXISTS on_client_sale_update_portfolio ON clients;
CREATE TRIGGER on_client_sale_update_portfolio
AFTER UPDATE OF is_sold, sale_value ON clients
FOR EACH ROW
EXECUTE FUNCTION update_portfolio_ticket_on_sale();

-- Corrigir tickets dos clientes já migrados
UPDATE portfolio_students ps
SET current_ticket = CASE
  WHEN c.is_sold = true AND c.sale_value >= 50000 THEN '80k'::public.ticket_type
  WHEN c.is_sold = true AND c.sale_value >= 5000 THEN '12k'::public.ticket_type
  ELSE '29_90'::public.ticket_type
END
FROM clients c
WHERE ps.client_id = c.id;