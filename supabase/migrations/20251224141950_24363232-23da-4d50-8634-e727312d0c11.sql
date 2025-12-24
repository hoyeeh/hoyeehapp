-- Fix: Restrict KYC data access to super admins only (not regular admins)
-- This addresses the security issue where sensitive KYC data was accessible to all admins

-- Drop existing admin KYC policies
DROP POLICY IF EXISTS "Admins can view all KYC" ON creator_kyc;
DROP POLICY IF EXISTS "Admins can update all KYC" ON creator_kyc;

-- Create new policies that restrict access to super_admin role only
CREATE POLICY "Super admins can view all KYC"
ON creator_kyc FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all KYC"
ON creator_kyc FOR UPDATE
USING (is_super_admin(auth.uid()));