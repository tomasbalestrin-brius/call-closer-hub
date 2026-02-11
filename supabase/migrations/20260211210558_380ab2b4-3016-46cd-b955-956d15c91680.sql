-- Performance indices for common queries (P1)

-- Calls: frequently queried by closer_id + call_date
CREATE INDEX IF NOT EXISTS idx_calls_closer_date ON public.calls(closer_id, call_date DESC);

-- Calls: filter by status
CREATE INDEX IF NOT EXISTS idx_calls_closer_status ON public.calls(closer_id, status);

-- Clients: filter by closer + status (Kanban)
CREATE INDEX IF NOT EXISTS idx_clients_closer_status ON public.clients(closer_id, status);

-- Clients: sold_at for dashboard sales queries
CREATE INDEX IF NOT EXISTS idx_clients_sold_at ON public.clients(sold_at DESC) WHERE is_sold = true;

-- Clients: funnel source filtering
CREATE INDEX IF NOT EXISTS idx_clients_funnel ON public.clients(funnel_source) WHERE funnel_source IS NOT NULL;

-- Portfolio students: closer + entry_date
CREATE INDEX IF NOT EXISTS idx_portfolio_closer_entry ON public.portfolio_students(closer_id, entry_date DESC);

-- Student activities: student lookup
CREATE INDEX IF NOT EXISTS idx_student_activities_student ON public.student_activities(student_id, activity_type);

-- Intensive leads: edition + status (Kanban)
CREATE INDEX IF NOT EXISTS idx_intensive_leads_edition_status ON public.intensive_leads(edition_id, status);

-- Intensive leads: closer + edition
CREATE INDEX IF NOT EXISTS idx_intensive_leads_closer ON public.intensive_leads(closer_id, edition_id);

-- Notifications: user unread
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = false;

-- Imported files: user + status for processing
CREATE INDEX IF NOT EXISTS idx_imported_files_user_status ON public.imported_files(user_id, status);

-- Indications: student lookup
CREATE INDEX IF NOT EXISTS idx_indications_student ON public.indications(student_id) WHERE student_id IS NOT NULL;

-- Analyze all tables
ANALYZE public.calls;
ANALYZE public.clients;
ANALYZE public.portfolio_students;
ANALYZE public.student_activities;
ANALYZE public.intensive_leads;
ANALYZE public.notifications;
ANALYZE public.imported_files;
ANALYZE public.indications;