
CREATE OR REPLACE FUNCTION public.backup_client_before_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO clients_backup (
    id, closer_id, name, name_normalized, email, phone, company, niche, status,
    source, revenue, has_partner, main_difficulty, main_pain, notes, sale_notes,
    negotiation_notes, entry_value, sale_value, followup_date, contract_validity,
    is_sold, sold_at, is_from_indication, indication_source_id, is_super_hot,
    data_completed_at, incomplete_notification_sent, repitch_overdue_notification_sent,
    status_changed_at, product_offered, sdr_name, funnel_source, created_at, updated_at,
    backup_reason, backed_up_by, origin_closer_name
  ) VALUES (
    OLD.id, OLD.closer_id, OLD.name, OLD.name_normalized, OLD.email, OLD.phone, OLD.company, OLD.niche, OLD.status,
    OLD.source, OLD.revenue, OLD.has_partner, OLD.main_difficulty, OLD.main_pain, OLD.notes, OLD.sale_notes,
    OLD.negotiation_notes, OLD.entry_value, OLD.sale_value, OLD.followup_date, OLD.contract_validity,
    OLD.is_sold, OLD.sold_at, OLD.is_from_indication, OLD.indication_source_id, OLD.is_super_hot,
    OLD.data_completed_at, OLD.incomplete_notification_sent, OLD.repitch_overdue_notification_sent,
    OLD.status_changed_at, OLD.product_offered, OLD.sdr_name, OLD.funnel_source, OLD.created_at, OLD.updated_at,
    TG_OP, auth.uid(), OLD.origin_closer_name
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;
