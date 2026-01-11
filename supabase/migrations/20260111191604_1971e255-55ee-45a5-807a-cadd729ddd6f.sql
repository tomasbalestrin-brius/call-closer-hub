-- Create client_activities table for tracking intensivo and mentoria participation
CREATE TABLE public.client_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('intensivo', 'mentoria')),
  activity_name TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can manage activities for their clients
CREATE POLICY "Users can view activities for their clients"
ON public.client_activities
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.clients
  WHERE clients.id = client_activities.client_id
  AND clients.closer_id = auth.uid()
));

CREATE POLICY "Users can create activities for their clients"
ON public.client_activities
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.clients
  WHERE clients.id = client_activities.client_id
  AND clients.closer_id = auth.uid()
));

CREATE POLICY "Users can update activities for their clients"
ON public.client_activities
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.clients
  WHERE clients.id = client_activities.client_id
  AND clients.closer_id = auth.uid()
));

CREATE POLICY "Users can delete activities for their clients"
ON public.client_activities
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.clients
  WHERE clients.id = client_activities.client_id
  AND clients.closer_id = auth.uid()
));

-- Add columns to clients table for indication tracking
ALTER TABLE public.clients 
ADD COLUMN is_from_indication BOOLEAN DEFAULT FALSE,
ADD COLUMN indication_source_id UUID REFERENCES public.indications(id);

-- Create index for better performance
CREATE INDEX idx_client_activities_client_id ON public.client_activities(client_id);
CREATE INDEX idx_client_activities_type ON public.client_activities(activity_type);
CREATE INDEX idx_clients_indication_source ON public.clients(indication_source_id) WHERE indication_source_id IS NOT NULL;