-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view active parties they're in" ON public.watch_parties;

-- Create new policy that allows authenticated users to view active parties
-- This enables joining parties by code
CREATE POLICY "Authenticated users can view active parties"
ON public.watch_parties
FOR SELECT
USING (
  is_active = true AND auth.uid() IS NOT NULL
);