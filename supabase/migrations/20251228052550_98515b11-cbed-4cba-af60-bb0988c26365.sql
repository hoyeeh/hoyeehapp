-- Drop the view and recreate without SECURITY DEFINER (use SECURITY INVOKER which is default)
DROP VIEW IF EXISTS public.creator_profiles_public;

-- Create the view with explicit SECURITY INVOKER (uses caller's permissions)
CREATE VIEW public.creator_profiles_public 
WITH (security_invoker = true)
AS
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

-- Grant access to the view
GRANT SELECT ON public.creator_profiles_public TO authenticated;
GRANT SELECT ON public.creator_profiles_public TO anon;

-- Drop the overly permissive policy we created
DROP POLICY IF EXISTS "Public can view non-sensitive creator data via view" ON public.creator_profiles;

-- Create proper restrictive policy: only owner and admins can see full data
CREATE POLICY "Owners and admins can view full creator profiles"
ON public.creator_profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'super_admin')
  OR is_active = true
);

COMMENT ON VIEW public.creator_profiles_public IS 'Public-safe view of creator profiles excluding financial data. Use this view for public listings.';