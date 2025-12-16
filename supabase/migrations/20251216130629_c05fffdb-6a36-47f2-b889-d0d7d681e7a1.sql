-- Fix the SECURITY DEFINER view issue by recreating with SECURITY INVOKER (default)
-- This ensures the view respects the calling user's RLS policies

DROP VIEW IF EXISTS public.profiles_safe;

-- Recreate view with explicit SECURITY INVOKER (which is the default but being explicit)
CREATE VIEW public.profiles_safe 
WITH (security_invoker = true) AS
SELECT 
  id,
  display_name,
  avatar_url,
  country,
  is_subscribed,
  subscription_expiry,
  parental_controls_enabled,
  parental_rating_limit,
  last_login_at,
  created_at,
  updated_at
FROM public.profiles;

-- Grant select access
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;

COMMENT ON VIEW public.profiles_safe IS 'Secure view of profiles table that excludes sensitive fields. Uses SECURITY INVOKER to respect RLS policies of the calling user.';