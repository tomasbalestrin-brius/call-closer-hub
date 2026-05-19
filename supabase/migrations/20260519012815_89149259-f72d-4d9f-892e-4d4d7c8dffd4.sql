
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE INDEX idx_login_attempts_created_at ON public.login_attempts (created_at DESC);
CREATE INDEX idx_login_attempts_email ON public.login_attempts (email);
