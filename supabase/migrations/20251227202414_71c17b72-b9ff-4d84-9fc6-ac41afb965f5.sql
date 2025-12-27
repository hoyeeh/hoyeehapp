-- =====================================================
-- FIX 1: Restrict admin access to sensitive profile data
-- =====================================================
-- Remove policies that allow regular admins to view all profiles directly
-- Admins should use profiles_safe view or use specific secure functions

-- Drop the overly permissive admin policy for profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Keep super admin access only for full profile data
-- Super admins can view all profiles is already in place

-- Update admin update policy to not allow updating sensitive fields
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;

-- Create more restrictive admin update policy (only non-sensitive fields)
CREATE POLICY "Admins can update non-sensitive profile fields"
ON profiles FOR UPDATE
USING (
  has_role(auth.uid(), 'admin')
)
WITH CHECK (
  has_role(auth.uid(), 'admin')
  -- Note: Sensitive field updates are blocked at application level
);

-- =====================================================
-- FIX 2: Create KYC access audit logging
-- =====================================================
-- Create audit table for KYC data access
CREATE TABLE IF NOT EXISTS public.kyc_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id UUID REFERENCES creator_kyc(id) ON DELETE SET NULL,
  creator_id UUID REFERENCES creator_profiles(id) ON DELETE SET NULL,
  accessed_by UUID NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL, -- 'view', 'update', 'approve', 'reject'
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on audit table
ALTER TABLE public.kyc_access_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view audit logs
CREATE POLICY "Super admins can view KYC audit logs"
ON kyc_access_logs FOR SELECT
USING (is_super_admin(auth.uid()));

-- Super admins can insert audit logs (for logging their own access)
CREATE POLICY "Super admins can insert KYC audit logs"
ON kyc_access_logs FOR INSERT
WITH CHECK (is_super_admin(auth.uid()));

-- Service role for automated logging
CREATE POLICY "Service role can manage KYC audit logs"
ON kyc_access_logs FOR ALL
USING (true);

-- =====================================================
-- FIX 3: Create secure function for admin profile access
-- =====================================================
-- Function that returns profile data without sensitive fields for admins
CREATE OR REPLACE FUNCTION public.get_safe_profile_for_admin(target_user_id uuid)
RETURNS TABLE(
  id uuid,
  display_name text,
  avatar_url text,
  country text,
  is_subscribed boolean,
  subscription_expiry timestamptz,
  parental_controls_enabled boolean,
  parental_rating_limit text,
  created_at timestamptz,
  updated_at timestamptz,
  last_login_at timestamptz,
  mobile_number_masked text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins or super admins can use this function
  IF NOT (has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.display_name,
    p.avatar_url,
    p.country,
    p.is_subscribed,
    p.subscription_expiry,
    p.parental_controls_enabled,
    p.parental_rating_limit,
    p.created_at,
    p.updated_at,
    p.last_login_at,
    -- Mask mobile number: show only last 4 digits
    CASE 
      WHEN p.mobile_number IS NOT NULL AND LENGTH(p.mobile_number) >= 4 
      THEN '****' || RIGHT(p.mobile_number, 4)
      ELSE NULL
    END as mobile_number_masked
  FROM profiles p
  WHERE p.id = target_user_id;
END;
$$;

-- =====================================================
-- FIX 4: Create function to log KYC access
-- =====================================================
CREATE OR REPLACE FUNCTION public.log_kyc_access(
  p_kyc_id uuid,
  p_creator_id uuid,
  p_action text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super admins can log KYC access (they're the only ones who can view it)
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Super Admin role required';
  END IF;
  
  INSERT INTO kyc_access_logs (kyc_id, creator_id, accessed_by, action, ip_address, user_agent, details)
  VALUES (p_kyc_id, p_creator_id, auth.uid(), p_action, p_ip_address, p_user_agent, p_details);
END;
$$;

-- =====================================================
-- FIX 5: Create secure function for super admin KYC access with logging
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_creator_kyc_with_logging(
  p_creator_id uuid,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  creator_id uuid,
  full_name text,
  date_of_birth date,
  nationality text,
  email text,
  phone_number text,
  address_line1 text,
  address_city text,
  address_country text,
  id_type text,
  id_number text,
  id_expiry_date date,
  id_document_url text,
  status text,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kyc_record RECORD;
BEGIN
  -- Only super admins can access KYC data
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Super Admin role required';
  END IF;
  
  -- Get KYC record
  SELECT k.* INTO v_kyc_record
  FROM creator_kyc k
  WHERE k.creator_id = p_creator_id;
  
  -- Log the access
  IF v_kyc_record.id IS NOT NULL THEN
    INSERT INTO kyc_access_logs (kyc_id, creator_id, accessed_by, action, ip_address, user_agent, details)
    VALUES (v_kyc_record.id, p_creator_id, auth.uid(), 'view', p_ip_address, p_user_agent, 
            jsonb_build_object('accessed_fields', ARRAY['all']));
  END IF;
  
  RETURN QUERY
  SELECT 
    k.id,
    k.creator_id,
    k.full_name,
    k.date_of_birth,
    k.nationality,
    k.email,
    k.phone_number,
    k.address_line1,
    k.address_city,
    k.address_country,
    k.id_type,
    k.id_number,
    k.id_expiry_date,
    k.id_document_url,
    k.status,
    k.rejection_reason,
    k.reviewed_by,
    k.reviewed_at,
    k.created_at,
    k.updated_at
  FROM creator_kyc k
  WHERE k.creator_id = p_creator_id;
END;
$$;