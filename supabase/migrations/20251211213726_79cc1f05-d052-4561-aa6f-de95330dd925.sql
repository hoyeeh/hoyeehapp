-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema to relevant roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move pgcrypto extension to extensions schema
-- Note: We need to drop and recreate in the new schema
DROP EXTENSION IF EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update the hash_profile_credentials function to use extensions schema
CREATE OR REPLACE FUNCTION public.hash_profile_credentials()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  -- Hash pin_code if it's being set/updated and isn't already hashed
  IF NEW.pin_code IS NOT NULL AND NEW.pin_code IS DISTINCT FROM OLD.pin_code THEN
    -- Only hash if it doesn't look like a bcrypt hash already
    IF NEW.pin_code NOT LIKE '$2a$%' AND NEW.pin_code NOT LIKE '$2b$%' THEN
      NEW.pin_code := extensions.crypt(NEW.pin_code, extensions.gen_salt('bf', 10));
    END IF;
  END IF;
  
  -- Hash secret_word if it's being set/updated and isn't already hashed
  IF NEW.secret_word IS NOT NULL AND NEW.secret_word IS DISTINCT FROM OLD.secret_word THEN
    IF NEW.secret_word NOT LIKE '$2a$%' AND NEW.secret_word NOT LIKE '$2b$%' THEN
      NEW.secret_word := extensions.crypt(NEW.secret_word, extensions.gen_salt('bf', 10));
    END IF;
  END IF;
  
  -- Hash parental_pin if it's being set/updated and isn't already hashed
  IF NEW.parental_pin IS NOT NULL AND NEW.parental_pin IS DISTINCT FROM OLD.parental_pin THEN
    IF NEW.parental_pin NOT LIKE '$2a$%' AND NEW.parental_pin NOT LIKE '$2b$%' THEN
      NEW.parental_pin := extensions.crypt(NEW.parental_pin, extensions.gen_salt('bf', 10));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update verify_pin_code to use extensions schema
CREATE OR REPLACE FUNCTION public.verify_pin_code(user_mobile text, input_pin text)
 RETURNS TABLE(user_id uuid, is_valid boolean, is_locked boolean, lock_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  profile_record RECORD;
BEGIN
  SELECT p.id, p.pin_code, p.pin_locked_until, p.pin_attempts
  INTO profile_record
  FROM public.profiles p
  WHERE p.mobile_number = user_mobile;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, FALSE, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  -- Check if account is locked
  IF profile_record.pin_locked_until IS NOT NULL AND profile_record.pin_locked_until > NOW() THEN
    RETURN QUERY SELECT profile_record.id, FALSE, TRUE, profile_record.pin_locked_until;
    RETURN;
  END IF;
  
  -- Verify the PIN using crypt comparison
  IF profile_record.pin_code = extensions.crypt(input_pin, profile_record.pin_code) THEN
    -- Reset attempts on successful login
    UPDATE public.profiles SET pin_attempts = 0, pin_locked_until = NULL WHERE id = profile_record.id;
    RETURN QUERY SELECT profile_record.id, TRUE, FALSE, NULL::TIMESTAMPTZ;
  ELSE
    -- Increment failed attempts
    UPDATE public.profiles 
    SET pin_attempts = COALESCE(pin_attempts, 0) + 1,
        pin_locked_until = CASE WHEN COALESCE(pin_attempts, 0) + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
    WHERE id = profile_record.id;
    RETURN QUERY SELECT profile_record.id, FALSE, FALSE, NULL::TIMESTAMPTZ;
  END IF;
END;
$function$;

-- Update verify_secret_word to use extensions schema
CREATE OR REPLACE FUNCTION public.verify_secret_word(user_mobile text, input_secret text)
 RETURNS TABLE(user_id uuid, is_valid boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  profile_record RECORD;
BEGIN
  SELECT p.id, p.secret_word
  INTO profile_record
  FROM public.profiles p
  WHERE p.mobile_number = user_mobile;
  
  IF NOT FOUND OR profile_record.secret_word IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE;
    RETURN;
  END IF;
  
  -- Verify the secret word using crypt comparison
  IF profile_record.secret_word = extensions.crypt(input_secret, profile_record.secret_word) THEN
    RETURN QUERY SELECT profile_record.id, TRUE;
  ELSE
    RETURN QUERY SELECT profile_record.id, FALSE;
  END IF;
END;
$function$;

-- Update verify_parental_pin to use extensions schema
CREATE OR REPLACE FUNCTION public.verify_parental_pin(user_uuid uuid, input_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  stored_pin TEXT;
BEGIN
  SELECT parental_pin INTO stored_pin
  FROM public.profiles
  WHERE id = user_uuid;
  
  IF stored_pin IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN stored_pin = extensions.crypt(input_pin, stored_pin);
END;
$function$;

-- Update reset_pin_secure to use extensions schema
CREATE OR REPLACE FUNCTION public.reset_pin_secure(user_mobile text, input_secret text, new_pin text)
 RETURNS TABLE(success boolean, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  profile_record RECORD;
BEGIN
  -- Find the profile
  SELECT p.id, p.secret_word, p.pin_attempts
  INTO profile_record
  FROM public.profiles p
  WHERE p.mobile_number = user_mobile;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Invalid credentials'::TEXT;
    RETURN;
  END IF;
  
  -- Rate limiting: Check recent failed attempts
  IF profile_record.pin_attempts >= 10 THEN
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
$function$;