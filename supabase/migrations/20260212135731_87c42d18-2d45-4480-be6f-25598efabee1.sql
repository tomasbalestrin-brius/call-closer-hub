ALTER TABLE public.clients 
ADD CONSTRAINT clients_closer_id_profiles_fkey 
FOREIGN KEY (closer_id) REFERENCES public.profiles(user_id);