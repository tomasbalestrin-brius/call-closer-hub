-- Create intensive_editions table
CREATE TABLE public.intensive_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create intensive_leads table
CREATE TABLE public.intensive_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id UUID NOT NULL REFERENCES intensive_editions(id) ON DELETE CASCADE,
  closer_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  company TEXT,
  niche TEXT,
  status TEXT NOT NULL DEFAULT 'abordagem_inicial',
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,
  source_client_id UUID REFERENCES clients(id),
  source_student_id UUID REFERENCES portfolio_students(id),
  indication_id UUID REFERENCES indications(id),
  confirmed_at TIMESTAMPTZ,
  ticket_retrieved_at TIMESTAMPTZ,
  attended_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create intensive_lead_notes table
CREATE TABLE public.intensive_lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES intensive_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.intensive_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intensive_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intensive_lead_notes ENABLE ROW LEVEL SECURITY;

-- RLS for intensive_editions
CREATE POLICY "Authenticated users can view editions" 
ON public.intensive_editions FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage editions" 
ON public.intensive_editions FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS for intensive_leads
CREATE POLICY "Closers can view their own leads" 
ON public.intensive_leads FOR SELECT 
USING (auth.uid() = closer_id);

CREATE POLICY "Admins can view all leads" 
ON public.intensive_leads FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Closers can create their own leads" 
ON public.intensive_leads FOR INSERT 
WITH CHECK (auth.uid() = closer_id);

CREATE POLICY "Closers can update their own leads" 
ON public.intensive_leads FOR UPDATE 
USING (auth.uid() = closer_id);

CREATE POLICY "Admins can manage all leads" 
ON public.intensive_leads FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Closers can delete their own leads" 
ON public.intensive_leads FOR DELETE 
USING (auth.uid() = closer_id);

-- RLS for intensive_lead_notes
CREATE POLICY "Users can view notes for their leads" 
ON public.intensive_lead_notes FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM intensive_leads 
  WHERE intensive_leads.id = intensive_lead_notes.lead_id 
  AND intensive_leads.closer_id = auth.uid()
));

CREATE POLICY "Admins can view all notes" 
ON public.intensive_lead_notes FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can create notes for their leads" 
ON public.intensive_lead_notes FOR INSERT 
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM intensive_leads 
  WHERE intensive_leads.id = intensive_lead_notes.lead_id 
  AND intensive_leads.closer_id = auth.uid()
));

CREATE POLICY "Users can delete their own notes" 
ON public.intensive_lead_notes FOR DELETE 
USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_intensive_editions_updated_at
BEFORE UPDATE ON public.intensive_editions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_intensive_leads_updated_at
BEFORE UPDATE ON public.intensive_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for status_changed_at
CREATE OR REPLACE FUNCTION public.update_intensive_lead_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_intensive_lead_status_changed
BEFORE UPDATE ON public.intensive_leads
FOR EACH ROW EXECUTE FUNCTION public.update_intensive_lead_status_changed_at();