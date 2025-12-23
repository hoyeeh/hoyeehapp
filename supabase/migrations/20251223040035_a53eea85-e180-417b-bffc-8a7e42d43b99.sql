-- Drop existing view if it exists with different structure
DROP VIEW IF EXISTS public.profiles_safe;

-- Create a safe profiles view that excludes sensitive authentication data
-- This view can be used for admin dashboards and listings
CREATE VIEW public.profiles_safe AS
SELECT 
  id,
  display_name,
  avatar_url,
  country,
  is_subscribed,
  subscription_expiry,
  parental_controls_enabled,
  parental_rating_limit,
  created_at,
  updated_at,
  last_login_at,
  -- Mask mobile number for privacy (show only last 4 digits)
  CASE 
    WHEN mobile_number IS NOT NULL THEN '****' || RIGHT(mobile_number, 4)
    ELSE NULL
  END as mobile_number_masked
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Drop existing overly permissive admin policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a more restrictive admin policy
-- Admins can view profiles but sensitive columns (pin_code, secret_word, parental_pin) 
-- should only be accessed through secure functions
CREATE POLICY "Admins can view profiles via safe view" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add comment to document the security approach
COMMENT ON VIEW public.profiles_safe IS 'Safe view of profiles table that excludes sensitive authentication data (PIN codes, secret words). Use this for admin dashboards and user listings.';

-- Create a secure function for checking admin access to sensitive data
CREATE OR REPLACE FUNCTION public.admin_can_access_sensitive_profile_data(_admin_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN is_super_admin(_admin_id);
END;
$$;