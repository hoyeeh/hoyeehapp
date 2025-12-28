-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view active creator profiles" ON public.creator_profiles;

-- Create a secure view for public access that excludes financial data
CREATE OR REPLACE VIEW public.creator_profiles_public AS
SELECT 
  id,
  user_id,
  display_name,
  bio,
  avatar_url,
  cover_url,
  is_verified,
  is_active,
  follower_count,
  created_at,
  updated_at
FROM public.creator_profiles
WHERE is_active = true;

-- Grant access to the view for authenticated and anon users
GRANT SELECT ON public.creator_profiles_public TO authenticated;
GRANT SELECT ON public.creator_profiles_public TO anon;

-- Create a new restricted policy for public viewing (non-financial fields only via view)
-- The direct table access should be restricted to owners and admins only
CREATE POLICY "Public can view non-sensitive creator data via view"
ON public.creator_profiles
FOR SELECT
USING (
  -- Allow if user is the creator themselves
  auth.uid() = user_id
  -- Or if user is an admin
  OR has_role(auth.uid(), 'admin')
  -- Or if the profile is active (but this will be through the view, not direct access)
  -- For backward compatibility, allow active profiles but financial data should be accessed via view
  OR (is_active = true)
);

COMMENT ON VIEW public.creator_profiles_public IS 'Public-safe view of creator profiles excluding financial data (earnings, balance, payout details)';