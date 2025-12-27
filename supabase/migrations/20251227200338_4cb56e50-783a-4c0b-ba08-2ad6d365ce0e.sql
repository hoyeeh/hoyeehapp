-- =====================================================
-- FIX 1: Server-side rate limiting for parental PIN verification
-- =====================================================
-- Update verify_parental_pin to implement server-side attempt tracking and lockout

CREATE OR REPLACE FUNCTION public.verify_parental_pin(user_uuid uuid, input_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_is_valid boolean;
  v_current_attempts integer;
BEGIN
  -- Get user profile
  SELECT * INTO v_profile FROM profiles WHERE id = user_uuid;
  
  -- If profile not found, return false
  IF v_profile IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if account is locked
  IF v_profile.pin_locked_until IS NOT NULL AND v_profile.pin_locked_until > now() THEN
    -- Still locked, return false without revealing lockout state
    RETURN false;
  END IF;
  
  -- If lockout has expired, reset attempts
  IF v_profile.pin_locked_until IS NOT NULL AND v_profile.pin_locked_until <= now() THEN
    UPDATE profiles 
    SET pin_attempts = 0, pin_locked_until = NULL 
    WHERE id = user_uuid;
    v_profile.pin_attempts := 0;
  END IF;
  
  -- Verify PIN using secure comparison (bcrypt)
  -- parental_pin is stored as hashed value using crypt()
  v_is_valid := (v_profile.parental_pin IS NOT NULL AND 
                 v_profile.parental_pin = crypt(input_pin, v_profile.parental_pin));
  
  IF v_is_valid THEN
    -- Success: Reset attempt counter
    UPDATE profiles 
    SET pin_attempts = 0, pin_locked_until = NULL 
    WHERE id = user_uuid;
    RETURN true;
  ELSE
    -- Failure: Increment attempt counter
    v_current_attempts := COALESCE(v_profile.pin_attempts, 0) + 1;
    
    -- Lock after 5 failed attempts for 30 minutes
    IF v_current_attempts >= 5 THEN
      UPDATE profiles 
      SET pin_attempts = v_current_attempts,
          pin_locked_until = now() + interval '30 minutes',
          lockout_count = COALESCE(lockout_count, 0) + 1
      WHERE id = user_uuid;
    ELSE
      UPDATE profiles 
      SET pin_attempts = v_current_attempts
      WHERE id = user_uuid;
    END IF;
    
    RETURN false;
  END IF;
END;
$$;

-- =====================================================
-- FIX 2: Make videos bucket private and update policies
-- =====================================================

-- Make the videos bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'videos';

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;

-- Create policy that requires authentication and subscription for video access
-- This works as a fallback - primary access should be via signed URLs
CREATE POLICY "Authenticated subscribers can access videos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'videos' AND
  auth.uid() IS NOT NULL AND
  (
    -- User has active subscription
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND is_subscribed = true
      AND (subscription_expiry IS NULL OR subscription_expiry > now())
    )
    OR
    -- User is an admin
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  )
);

-- Ensure admins can upload videos
DROP POLICY IF EXISTS "Admins can upload videos" ON storage.objects;
CREATE POLICY "Admins can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'videos' AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Ensure admins can update videos
DROP POLICY IF EXISTS "Admins can update videos" ON storage.objects;
CREATE POLICY "Admins can update videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'videos' AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- Ensure admins can delete videos
DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;
CREATE POLICY "Admins can delete videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'videos' AND
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);