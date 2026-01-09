-- 1. Create closer_level ENUM
CREATE TYPE public.closer_level AS ENUM (
  'assessor',
  'executivo',
  'pro',
  'elite',
  'especialista',
  'especialista_pro',
  'especialista_elite'
);

-- 2. Add closer_level to profiles table
ALTER TABLE public.profiles 
ADD COLUMN closer_level public.closer_level NOT NULL DEFAULT 'assessor';

-- 3. Create monthly_goals table
CREATE TABLE public.monthly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closer_id UUID NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  goal_value NUMERIC NOT NULL CHECK (goal_value > 0),
  set_by_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (closer_id, month, year)
);

-- Enable RLS on monthly_goals
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monthly_goals
CREATE POLICY "Closers can view their own goals"
ON public.monthly_goals
FOR SELECT
USING (auth.uid() = closer_id);

CREATE POLICY "Admins can manage all goals"
ON public.monthly_goals
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Leaders can manage goals for their squad members"
ON public.monthly_goals
FOR ALL
USING (
  has_role(auth.uid(), 'lider'::user_role) AND
  EXISTS (
    SELECT 1 FROM squad_members sm1
    JOIN squad_members sm2 ON sm1.squad_id = sm2.squad_id
    WHERE sm1.user_id = auth.uid()
    AND sm2.user_id = monthly_goals.closer_id
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_monthly_goals_updated_at
BEFORE UPDATE ON public.monthly_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create daily_verses table
CREATE TABLE public.daily_verses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_year INTEGER NOT NULL UNIQUE CHECK (day_of_year >= 1 AND day_of_year <= 366),
  verse_text TEXT NOT NULL,
  reference TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on daily_verses (public read)
ALTER TABLE public.daily_verses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read verses"
ON public.daily_verses
FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage verses"
ON public.daily_verses
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));