-- Create secure RPC function for admin to reset user secret word
-- Includes validation, rate limiting, and audit logging
CREATE OR REPLACE FUNCTION public.admin_reset_secret_word(
  target_user_id UUID,
  new_secret TEXT
)
RETURNS TABLE(success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  admin_id UUID;
  recent_resets INTEGER;
  common_words TEXT[] := ARRAY['password', 'secret', 'test', '123456', 'qwerty', 'admin', 'user', 'login'];
BEGIN
  -- Get calling admin's ID
  admin_id := auth.uid();
  
  -- Verify caller has admin role
  IF NOT has_role(admin_id, 'admin') THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized: Admin role required'::TEXT;
    RETURN;
  END IF;
  
  -- Rate limiting: Max 10 resets per admin per hour
  SELECT COUNT(*) INTO recent_resets
  FROM audit_logs
  WHERE audit_logs.admin_id = admin_reset_secret_word.admin_id
    AND action = 'reset_secret'
    AND created_at > NOW() - INTERVAL '1 hour';
  
  IF recent_resets >= 10 THEN
    RETURN QUERY SELECT FALSE, 'Rate limit exceeded: Maximum 10 resets per hour'::TEXT;
    RETURN;
  END IF;
  
  -- Validate minimum length (8 characters for security)
  IF new_secret IS NULL OR LENGTH(TRIM(new_secret)) < 8 THEN
    RETURN QUERY SELECT FALSE, 'Secret word must be at least 8 characters'::TEXT;
    RETURN;
  END IF;
  
  -- Check for common/weak words
  IF LOWER(TRIM(new_secret)) = ANY(common_words) THEN
    RETURN QUERY SELECT FALSE, 'Secret word is too common. Please choose a stronger one.'::TEXT;
    RETURN;
  END IF;
  
  -- Verify target user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT;
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
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;