-- Fix profiles_safe view security by creating it with proper RLS
-- Note: Views with security_invoker already respect underlying table RLS
-- The profiles_safe view was created to expose non-sensitive profile data
-- We need to ensure it only allows users to see their own data or admins to see all

-- First, let's revoke public access and set proper permissions
REVOKE ALL ON public.profiles_safe FROM anon;
REVOKE ALL ON public.profiles_safe FROM authenticated;

-- Grant select only to authenticated users (RLS on underlying profiles table will filter)
GRANT SELECT ON public.profiles_safe TO authenticated;

-- The underlying profiles table already has proper RLS:
-- - Users can view their own profile (auth.uid() = id)
-- - Admins can view all profiles (has_role(auth.uid(), 'admin'))
-- Since profiles_safe uses SECURITY INVOKER, it respects these policies