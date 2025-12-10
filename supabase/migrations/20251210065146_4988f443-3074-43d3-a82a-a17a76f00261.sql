-- Add session tracking for single device login
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS active_session_id TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create a function for secure PIN reset with rate limiting
CREATE OR REPLACE FUNCTION public.reset_pin_secure(
  user_mobile TEXT,
  input_secret TEXT,
  new_pin TEXT
)
RETURNS TABLE(success BOOLEAN, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_record RECORD;
  reset_count INTEGER;
BEGIN
  -- Find the profile
  SELECT p.id, p.secret_word, p.pin_attempts
  INTO profile_record
  FROM public.profiles p
  WHERE p.mobile_number = user_mobile;
  
  IF NOT FOUND THEN
    -- Generic error to prevent enumeration
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT;
    RETURN;
  END IF;
  
  -- Rate limiting: Check recent failed attempts (use pin_attempts as a proxy)
  IF profile_record.pin_attempts >= 10 THEN
    RETURN QUERY SELECT FALSE, 'Too many attempts. Please try again later.'::TEXT;
    RETURN;
  END IF;
  
  -- Verify secret word (hashed comparison)
  IF profile_record.secret_word IS NULL OR 
     profile_record.secret_word != crypt(input_secret, profile_record.secret_word) THEN
    -- Increment attempts for rate limiting
    UPDATE public.profiles 
    SET pin_attempts = COALESCE(pin_attempts, 0) + 1
    WHERE id = profile_record.id;
    
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT;
    RETURN;
  END IF;
  
  -- Validate new PIN format (6 digits)
  IF new_pin IS NULL OR LENGTH(new_pin) != 6 OR new_pin !~ '^\d{6}$' THEN
    RETURN QUERY SELECT FALSE, 'PIN must be exactly 6 digits'::TEXT;
    RETURN;
  END IF;
  
  -- Reset PIN (trigger will hash it) and clear attempts
  UPDATE public.profiles 
  SET pin_code = new_pin,
      pin_attempts = 0,
      pin_locked_until = NULL
  WHERE id = profile_record.id;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;