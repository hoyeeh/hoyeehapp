-- First, drop the existing public view and recreate with security_invoker
DROP VIEW IF EXISTS public.creator_profiles_public;

-- Create the public view with security_invoker to respect RLS
CREATE VIEW public.creator_profiles_public
WITH (security_invoker=on) AS
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
FROM creator_profiles
WHERE is_active = true;

-- Grant access to the view
GRANT SELECT ON public.creator_profiles_public TO anon, authenticated;

-- Now update RLS policies on the base table to be restrictive
-- First drop the conflicting policies that allow public read
DROP POLICY IF EXISTS "Owners and admins can view full creator profiles" ON public.creator_profiles;
DROP POLICY IF EXISTS "Creators can view own profile" ON public.creator_profiles;
DROP POLICY IF EXISTS "Admins can view all creator profiles" ON public.creator_profiles;
DROP POLICY IF EXISTS "Anyone can view creator profiles" ON public.creator_profiles;
DROP POLICY IF EXISTS "Public can view creator profiles" ON public.creator_profiles;
DROP POLICY IF EXISTS "Creator profiles are publicly viewable" ON public.creator_profiles;

-- Create a single comprehensive SELECT policy that allows:
-- 1. Owners to see their own full profile
-- 2. Admins/Super admins to see all profiles
-- 3. The public view to work (via security invoker selecting only safe columns)
CREATE POLICY "Owners admins and public view can read"
ON public.creator_profiles FOR SELECT
USING (
  auth.uid() = user_id 
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    -- Allow read of public-safe fields only when accessed through the view
    -- This is achieved by only exposing non-sensitive fields in the view
    is_active = true
  )
);

-- Actually, the above still exposes everything. We need a different approach.
-- Let's use RLS to completely deny public SELECT and only allow through the view.

-- Drop the policy we just created
DROP POLICY IF EXISTS "Owners admins and public view can read" ON public.creator_profiles;

-- Create restrictive policies
-- Policy 1: Owners can view their own profile (full access)
CREATE POLICY "Owners can view own full profile"
ON public.creator_profiles FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Admins can view all profiles (full access)
CREATE POLICY "Admins can view all profiles"
ON public.creator_profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Policy 3: Allow reading only active profiles (for the public view to work)
-- But we need to ensure the view only shows non-sensitive columns
CREATE POLICY "Public can read active profiles for view"
ON public.creator_profiles FOR SELECT
USING (is_active = true);

-- The key security is that the VIEW only exposes safe columns, not the table itself
-- However, users could still query the table directly. 

-- Better approach: Use a security definer function for public access
-- Drop the permissive policy
DROP POLICY IF EXISTS "Public can read active profiles for view" ON public.creator_profiles;

-- Drop the view and recreate WITHOUT security_invoker so it uses owner permissions
DROP VIEW IF EXISTS public.creator_profiles_public;

-- Create the public view with security_barrier to prevent predicate pushdown attacks
CREATE VIEW public.creator_profiles_public
WITH (security_barrier=true) AS
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
FROM creator_profiles
WHERE is_active = true;

-- Grant access to the view for all users
GRANT SELECT ON public.creator_profiles_public TO anon, authenticated;

-- The view runs with definer (postgres) permissions so it bypasses RLS
-- Now the base table RLS only allows owners and admins