-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own imported files" ON imported_files;

-- Create new SELECT policy that allows:
-- 1. Users to see their own imported files
-- 2. Admins to see ALL imported files
CREATE POLICY "Users can view own files, admins can view all" 
ON imported_files 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin'::public.user_role)
);