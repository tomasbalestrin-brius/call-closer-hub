-- Create enum for ticket types
CREATE TYPE public.ticket_type AS ENUM ('29_90', '12k', '80k');

-- Create enum for student activity types
CREATE TYPE public.student_activity_type AS ENUM ('intensivo', 'mentoria', 'evento');

-- Create portfolio_students table
CREATE TABLE public.portfolio_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  closer_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  current_ticket public.ticket_type NOT NULL DEFAULT '29_90',
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  niche TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket_upgrades table
CREATE TABLE public.ticket_upgrades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.portfolio_students(id) ON DELETE CASCADE,
  from_ticket public.ticket_type NOT NULL,
  to_ticket public.ticket_type NOT NULL,
  upgrade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sale_value NUMERIC,
  entry_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create student_activities table
CREATE TABLE public.student_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.portfolio_students(id) ON DELETE CASCADE,
  activity_type public.student_activity_type NOT NULL,
  activity_name TEXT NOT NULL,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add student_id column to indications table
ALTER TABLE public.indications ADD COLUMN student_id UUID REFERENCES public.portfolio_students(id) ON DELETE SET NULL;

-- Enable RLS on all new tables
ALTER TABLE public.portfolio_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for portfolio_students
CREATE POLICY "Closers can view their own students"
ON public.portfolio_students
FOR SELECT
USING (auth.uid() = closer_id);

CREATE POLICY "Closers can create their own students"
ON public.portfolio_students
FOR INSERT
WITH CHECK (auth.uid() = closer_id);

CREATE POLICY "Closers can update their own students"
ON public.portfolio_students
FOR UPDATE
USING (auth.uid() = closer_id);

CREATE POLICY "Closers can delete their own students"
ON public.portfolio_students
FOR DELETE
USING (auth.uid() = closer_id);

CREATE POLICY "Admins can view all students"
ON public.portfolio_students
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for ticket_upgrades
CREATE POLICY "Users can view upgrades for their students"
ON public.ticket_upgrades
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = ticket_upgrades.student_id
  AND portfolio_students.closer_id = auth.uid()
));

CREATE POLICY "Users can create upgrades for their students"
ON public.ticket_upgrades
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = ticket_upgrades.student_id
  AND portfolio_students.closer_id = auth.uid()
));

CREATE POLICY "Users can update upgrades for their students"
ON public.ticket_upgrades
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = ticket_upgrades.student_id
  AND portfolio_students.closer_id = auth.uid()
));

CREATE POLICY "Users can delete upgrades for their students"
ON public.ticket_upgrades
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = ticket_upgrades.student_id
  AND portfolio_students.closer_id = auth.uid()
));

-- RLS Policies for student_activities
CREATE POLICY "Users can view activities for their students"
ON public.student_activities
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = student_activities.student_id
  AND portfolio_students.closer_id = auth.uid()
));

CREATE POLICY "Users can create activities for their students"
ON public.student_activities
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = student_activities.student_id
  AND portfolio_students.closer_id = auth.uid()
));

CREATE POLICY "Users can update activities for their students"
ON public.student_activities
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = student_activities.student_id
  AND portfolio_students.closer_id = auth.uid()
));

CREATE POLICY "Users can delete activities for their students"
ON public.student_activities
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.portfolio_students
  WHERE portfolio_students.id = student_activities.student_id
  AND portfolio_students.closer_id = auth.uid()
));

-- Create trigger for updated_at on portfolio_students
CREATE TRIGGER update_portfolio_students_updated_at
BEFORE UPDATE ON public.portfolio_students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();