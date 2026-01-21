-- Corrigir a view profiles_safe removendo SECURITY DEFINER
-- Recriar como view normal com SECURITY INVOKER (padrão)
DROP VIEW IF EXISTS public.profiles_safe;

-- A view herda automaticamente as políticas RLS da tabela profiles
-- Não precisa de SECURITY DEFINER pois já temos RLS na tabela base
CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
SELECT 
  id, user_id, full_name, avatar_url, phone, status,
  google_connected, google_email, closer_level,
  drive_folder_id, drive_folder_name, drive_last_sync,
  drive_auto_import, drive_import_frequency,
  drive_file_types, drive_name_patterns,
  created_at, updated_at
FROM profiles;

-- Conceder acesso à view
GRANT SELECT ON public.profiles_safe TO authenticated;