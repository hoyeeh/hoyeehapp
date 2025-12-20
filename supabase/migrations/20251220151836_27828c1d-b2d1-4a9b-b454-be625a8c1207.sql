-- Drop existing function to change return type
DROP FUNCTION IF EXISTS public.admin_reset_secret_word(uuid, text);

-- Create updated admin_reset_secret_word with super_admin requirement and email return
CREATE OR REPLACE FUNCTION public.admin_reset_secret_word(
  target_user_id UUID,
  new_secret TEXT
)
RETURNS TABLE(success BOOLEAN, error_message TEXT, user_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  admin_id UUID;
  recent_resets INTEGER;
  target_email TEXT;
  common_words TEXT[] := ARRAY['password', 'secret', 'test', '123456', 'qwerty', 'admin', 'user', 'login'];
BEGIN
  admin_id := auth.uid();
  
  -- Require super_admin role for this sensitive operation
  IF NOT is_super_admin(admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Super Admin role required for this sensitive operation'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Rate limiting: Max 10 resets per admin per hour
  SELECT COUNT(*) INTO recent_resets
  FROM audit_logs
  WHERE audit_logs.admin_id = admin_reset_secret_word.admin_id
    AND action = 'reset_secret'
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_resets >= 10 THEN
    RETURN QUERY SELECT FALSE, 'Rate limit exceeded: Maximum 10 resets per hour'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Validate minimum length (8 characters for security)
  IF new_secret IS NULL OR LENGTH(TRIM(new_secret)) < 8 THEN
    RETURN QUERY SELECT FALSE, 'Secret word must be at least 8 characters'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check for common/weak words
  IF LOWER(TRIM(new_secret)) = ANY(common_words) THEN
    RETURN QUERY SELECT FALSE, 'Secret word is too common. Please choose a stronger one.'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Verify target user exists and get their email
  SELECT u.email INTO target_email
  FROM auth.users u
  WHERE u.id = target_user_id;
  
  IF target_email IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Update secret word (trigger will hash it automatically)
  UPDATE profiles 
  SET secret_word = LOWER(TRIM(new_secret))
  WHERE id = target_user_id;
  
  -- Log the action to audit_logs
  INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
  VALUES (
    admin_id,
    'reset_secret',
    'profile',
    target_user_id::TEXT,
    jsonb_build_object(
      'action', 'secret_word_reset',
      'target_user_id', target_user_id,
      'timestamp', NOW()
    )
  );
  
  RETURN QUERY SELECT TRUE, NULL::TEXT, target_email;
END;
$$;

-- Create secure RPC function for admin PIN reset with super_admin requirement
CREATE OR REPLACE FUNCTION public.admin_reset_pin(
  target_user_id UUID
)
RETURNS TABLE(success BOOLEAN, error_message TEXT, user_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  admin_id UUID;
  recent_resets INTEGER;
  target_email TEXT;
BEGIN
  admin_id := auth.uid();
  
  -- Require super_admin role for this sensitive operation
  IF NOT is_super_admin(admin_id) THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Super Admin role required for this sensitive operation'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Rate limiting: Max 10 resets per admin per hour
  SELECT COUNT(*) INTO recent_resets
  FROM audit_logs
  WHERE audit_logs.admin_id = admin_reset_pin.admin_id
    AND action = 'reset_pin'
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_resets >= 10 THEN
    RETURN QUERY SELECT FALSE, 'Rate limit exceeded: Maximum 10 resets per hour'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Verify target user exists and get their email
  SELECT u.email INTO target_email
  FROM auth.users u
  WHERE u.id = target_user_id;
  
  IF target_email IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Reset PIN
  UPDATE profiles 
  SET pin_code = NULL,
      pin_attempts = 0,
      pin_locked_until = NULL
  WHERE id = target_user_id;
  
  -- Log the action to audit_logs
  INSERT INTO audit_logs (admin_id, action, resource_type, resource_id, details)
  VALUES (
    admin_id,
    'reset_pin',
    'profile',
    target_user_id::TEXT,
    jsonb_build_object(
      'action', 'pin_reset',
      'target_user_id', target_user_id,
      'timestamp', NOW()
    )
  );
  
  RETURN QUERY SELECT TRUE, NULL::TEXT, target_email;
END;
$$;