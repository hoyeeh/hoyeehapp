-- Fix RLS policies for profiles and creator_kyc tables
-- The issue: Some policies target 'public' role instead of 'authenticated' role
-- This could theoretically allow policy evaluation for anonymous users

-- ==========================================
-- PROFILES TABLE FIXES
-- ==========================================

-- Drop policies that incorrectly target public role
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update non-sensitive profile fields" ON profiles;
DROP POLICY IF EXISTS "Super admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;

-- Recreate INSERT policy for authenticated users only
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Recreate UPDATE policy for users - merge duplicates
-- Note: There was a duplicate "Users can update own profile" and "Users can update their own profile"
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Recreate admin policies for authenticated only
CREATE POLICY "Admins can update non-sensitive profile fields" 
ON profiles FOR UPDATE 
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Super admins can update any profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (is_super_admin(auth.uid()));

-- Super admins SELECT - merge duplicates (there were two policies)
DROP POLICY IF EXISTS "Super admins can SELECT all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles" 
ON profiles FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()));

-- ==========================================
-- CREATOR_KYC TABLE FIXES
-- ==========================================

-- Drop all existing policies that target public role
DROP POLICY IF EXISTS "Creators can insert their own KYC" ON creator_kyc;
DROP POLICY IF EXISTS "Creators can update their own KYC" ON creator_kyc;
DROP POLICY IF EXISTS "Creators can view their own KYC" ON creator_kyc;
DROP POLICY IF EXISTS "Super admins can update all KYC" ON creator_kyc;
DROP POLICY IF EXISTS "Super admins can view all KYC" ON creator_kyc;

-- Recreate all policies targeting authenticated role only
CREATE POLICY "Creators can view their own KYC" 
ON creator_kyc FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM creator_profiles cp
    WHERE cp.id = creator_kyc.creator_id 
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Creators can insert their own KYC" 
ON creator_kyc FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM creator_profiles cp
    WHERE cp.id = creator_kyc.creator_id 
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Creators can update their own KYC" 
ON creator_kyc FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM creator_profiles cp
    WHERE cp.id = creator_kyc.creator_id 
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Super admins can view all KYC" 
ON creator_kyc FOR SELECT 
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all KYC" 
ON creator_kyc FOR UPDATE 
TO authenticated
USING (is_super_admin(auth.uid()));