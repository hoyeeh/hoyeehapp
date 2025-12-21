-- Add lockout_count column to track repeated lockouts for exponential backoff
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS lockout_count integer DEFAULT 0;

-- Update verify_pin_code function with exponential backoff
CREATE OR REPLACE FUNCTION public.verify_pin_code(user_mobile text, input_pin text)
RETURNS TABLE(user_id uuid, is_valid boolean, is_locked boolean, lock_until timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  profile_record RECORD;
  lockout_minutes integer;
BEGIN
  SELECT p.id, p.pin_code, p.pin_locked_until, p.pin_attempts, p.lockout_count
  INTO profile_record
  FROM public.profiles p
  WHERE p.mobile_number = user_mobile;
  
  IF NOT FOUND THEN
    -- Don't reveal if user exists - return generic response
    PERFORM pg_sleep(0.5); -- Add delay to prevent timing attacks
    RETURN QUERY SELECT NULL::UUID, FALSE, FALSE, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  -- Check if account is locked
  IF profile_record.pin_locked_until IS NOT NULL AND profile_record.pin_locked_until > NOW() THEN
    RETURN QUERY SELECT profile_record.id, FALSE, TRUE, profile_record.pin_locked_until;
    RETURN;
  END IF;
  
  -- Clear lock if expired
  IF profile_record.pin_locked_until IS NOT NULL AND profile_record.pin_locked_until <= NOW() THEN
    UPDATE public.profiles 
    SET pin_locked_until = NULL
    WHERE id = profile_record.id;
  END IF;
  
  -- Verify the PIN using crypt comparison
  IF profile_record.pin_code = extensions.crypt(input_pin, profile_record.pin_code) THEN
    -- Reset attempts and lockout count on successful login
    UPDATE public.profiles 
    SET pin_attempts = 0, 
        pin_locked_until = NULL,
        lockout_count = 0
    WHERE id = profile_record.id;
    RETURN QUERY SELECT profile_record.id, TRUE, FALSE, NULL::TIMESTAMPTZ;
  ELSE
    -- Increment failed attempts
    -- Calculate exponential backoff: 15 * 2^lockout_count minutes (15, 30, 60, 120, etc.)
    -- Max lockout of 24 hours
    lockout_minutes := LEAST(15 * POWER(2, COALESCE(profile_record.lockout_count, 0))::integer, 1440);
    
    UPDATE public.profiles 
    SET pin_attempts = COALESCE(pin_attempts, 0) + 1,
        pin_locked_until = CASE 
          WHEN COALESCE(pin_attempts, 0) + 1 >= 5 
          THEN NOW() + (lockout_minutes || ' minutes')::interval 
          ELSE NULL 
        END,
        lockout_count = CASE 
          WHEN COALESCE(pin_attempts, 0) + 1 >= 5 
          THEN COALESCE(lockout_count, 0) + 1 
          ELSE lockout_count 
        END
    WHERE id = profile_record.id;
    
    -- Add delay to prevent timing attacks
    PERFORM pg_sleep(0.3);
    
    RETURN QUERY SELECT profile_record.id, FALSE, FALSE, NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

-- Update reset_pin_secure with better rate limiting
CREATE OR REPLACE FUNCTION public.reset_pin_secure(user_mobile text, input_secret text, new_pin text)
RETURNS TABLE(success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  profile_record RECORD;
  reset_lockout_minutes integer;
BEGIN
  -- Find the profile
  SELECT p.id, p.secret_word, p.pin_attempts, p.lockout_count, p.pin_locked_until
  INTO profile_record
  FROM public.profiles p
  WHERE p.mobile_number = user_mobile;
  
  IF NOT FOUND THEN
    -- Add delay to prevent user enumeration
    PERFORM pg_sleep(0.5);
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT;
    RETURN;
  END IF;
  
  -- Check if currently locked out from too many PIN attempts
  IF profile_record.pin_locked_until IS NOT NULL AND profile_record.pin_locked_until > NOW() THEN
    RETURN QUERY SELECT FALSE, 'Account temporarily locked. Please try again later.'::TEXT;
    RETURN;
  END IF;
  
  -- Rate limiting: Check recent failed attempts (max 5 reset attempts per lockout period)
  IF profile_record.pin_attempts >= 10 THEN
    -- Calculate exponential backoff for reset attempts
    reset_lockout_minutes := LEAST(30 * POWER(2, COALESCE(profile_record.lockout_count, 0))::integer, 1440);
    
    UPDATE public.profiles 
    SET pin_locked_until = NOW() + (reset_lockout_minutes || ' minutes')::interval,
        lockout_count = COALESCE(lockout_count, 0) + 1
    WHERE id = profile_record.id;
    
    RETURN QUERY SELECT FALSE, 'Too many attempts. Please try again later.'::TEXT;
    RETURN;
  END IF;
  
  -- Verify secret word (hashed comparison)
  IF profile_record.secret_word IS NULL OR 
     profile_record.secret_word != extensions.crypt(input_secret, profile_record.secret_word) THEN
    -- Increment attempts for rate limiting
    UPDATE public.profiles 
    SET pin_attempts = COALESCE(pin_attempts, 0) + 1
    WHERE id = profile_record.id;
    
    -- Add delay to prevent timing attacks
    PERFORM pg_sleep(0.3);
    
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
      pin_locked_until = NULL,
      lockout_count = 0
  WHERE id = profile_record.id;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

-- Add comment explaining the rate limiting
COMMENT ON COLUMN public.profiles.lockout_count IS 'Tracks consecutive lockouts for exponential backoff rate limiting';