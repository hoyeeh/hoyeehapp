-- Drop the existing public policy
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;

-- Create a new policy that only allows authenticated users to view reviews
CREATE POLICY "Authenticated users can view reviews" 
ON public.reviews 
FOR SELECT 
TO authenticated
USING (true);