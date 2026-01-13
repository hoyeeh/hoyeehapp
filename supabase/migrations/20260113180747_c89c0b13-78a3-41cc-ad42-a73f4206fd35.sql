-- =====================================================
-- SECURITY IMPROVEMENTS - CONTINUED
-- Drop the conflicting policy first, then recreate
-- =====================================================

-- Drop the specific conflicting policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate the update policy
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);