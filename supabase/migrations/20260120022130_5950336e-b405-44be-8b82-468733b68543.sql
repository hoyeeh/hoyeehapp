-- =====================================================
-- SECURITY FIX: Restrict KYC Access to Super Admins Only
-- =====================================================

-- Drop the existing admin KYC policies that allow regular admins
DROP POLICY IF EXISTS "Admins can view all KYC" ON public.creator_kyc;
DROP POLICY IF EXISTS "Admins can update all KYC" ON public.creator_kyc;

-- Recreate as super admin only policies (if they don't already exist)
DROP POLICY IF EXISTS "Super admins can view all KYC" ON public.creator_kyc;
DROP POLICY IF EXISTS "Super admins can update all KYC" ON public.creator_kyc;

CREATE POLICY "Super admins can view all KYC"
ON public.creator_kyc
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all KYC"
ON public.creator_kyc
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- =====================================================
-- SECURITY FIX: Ensure profiles base table is properly protected
-- =====================================================

-- Drop any overly permissive admin SELECT policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;

-- Create super admin only policy for viewing all profiles (needed for admin operations)
-- Regular admins should use profiles_safe view or get_safe_profile_for_admin function
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Ensure users can only SELECT their own profile
-- This policy already exists but recreate to ensure it's correct
DROP POLICY IF EXISTS "Users can SELECT own profile" ON public.profiles;

CREATE POLICY "Users can SELECT own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Add a comment to document the security architecture
COMMENT ON TABLE public.profiles IS 'User profiles table. SECURITY: Direct SELECT access is restricted to profile owners and super admins only. Regular admins must use profiles_safe view or get_safe_profile_for_admin() function to access user data. Sensitive fields (pin_code, secret_word, parental_pin) are hashed and never exposed directly.';