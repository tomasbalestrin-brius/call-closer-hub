-- Add Google OAuth columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_access_token text,
ADD COLUMN IF NOT EXISTS google_refresh_token text,
ADD COLUMN IF NOT EXISTS google_token_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS google_email text,
ADD COLUMN IF NOT EXISTS google_connected boolean DEFAULT false;

-- Add status column to profiles for admin approval flow
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_google_connected ON public.profiles(google_connected);