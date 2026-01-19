-- Fix conflicting RLS policies on profiles table
-- Issue: Multiple SELECT policies with different conditions causing confusion

-- Step 1: Drop all existing SELECT policies on profiles table to start clean
DROP POLICY IF EXISTS "Admins can view profiles via safe view" ON public.profiles;
DROP POLICY IF EXISTS "No direct user SELECT on profiles base table" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Step 2: Create clear, non-conflicting SELECT policies
-- Regular users CANNOT directly access the base profiles table
-- They MUST use the profiles_safe view which masks sensitive data

-- Policy 1: Users can view their own profile through the base table
-- (needed for UPDATE operations that require SELECT first)
CREATE POLICY "Users can SELECT own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Admins can view all profiles
CREATE POLICY "Admins can SELECT all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy 3: Super admins can view all profiles
CREATE POLICY "Super admins can SELECT all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));