-- Create a secure view for profiles that exposes only non-sensitive fields
-- This view can be used for public access while keeping sensitive data protected

-- First, drop the existing profiles RLS policies that allow viewing by ID
-- and create more restrictive policies

-- Update RLS policies for profiles table to ensure sensitive fields are never exposed to others
-- Users can only see their own full profile, admins can see all profiles but through secure views

-- The existing RLS policies are already correct:
-- "Users can view their own profile" - USING (auth.uid() = id)
-- "Admins can view all profiles" - USING has_role(auth.uid(), 'admin')

-- The issue is that the profiles_safe view needs to be used for any public access
-- Let's verify the profiles_safe view exists and update it if needed

-- Drop and recreate profiles_safe view to ensure it only includes non-sensitive columns
DROP VIEW IF EXISTS public.profiles_safe;

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
  last_login_at,
  created_at,
  updated_at
FROM public.profiles;

-- Grant select access to authenticated users on the safe view
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;

-- Add a comment explaining the security design
COMMENT ON VIEW public.profiles_safe IS 'Secure view of profiles table that excludes sensitive fields like mobile_number, pin_code, parental_pin, and secret_word. Use this view for any queries where user data needs to be visible to other users or public access.';

-- Ensure the main profiles table RLS policies only allow self-access for sensitive data
-- The existing policies are correct but let's add an explicit comment
COMMENT ON TABLE public.profiles IS 'User profiles table with sensitive fields (mobile_number, pin_code, parental_pin, secret_word) protected by RLS. Only the owner can view/update their own profile. Use profiles_safe view for any cross-user queries.';