-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to hash sensitive credentials before storing
CREATE OR REPLACE FUNCTION public.hash_profile_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hash pin_code if it's being set/updated and isn't already hashed
  IF NEW.pin_code IS NOT NULL AND NEW.pin_code IS DISTINCT FROM OLD.pin_code THEN
    -- Only hash if it doesn't look like a bcrypt hash already
    IF NEW.pin_code NOT LIKE '$2a$%' AND NEW.pin_code NOT LIKE '$2b$%' THEN
      NEW.pin_code := crypt(NEW.pin_code, gen_salt('bf', 10));
    END IF;
  END IF;
  
  -- Hash secret_word if it's being set/updated and isn't already hashed
  IF NEW.secret_word IS NOT NULL AND NEW.secret_word IS DISTINCT FROM OLD.secret_word THEN
    IF NEW.secret_word NOT LIKE '$2a$%' AND NEW.secret_word NOT LIKE '$2b$%' THEN
      NEW.secret_word := crypt(NEW.secret_word, gen_salt('bf', 10));
    END IF;
  END IF;
  
  -- Hash parental_pin if it's being set/updated and isn't already hashed
  IF NEW.parental_pin IS NOT NULL AND NEW.parental_pin IS DISTINCT FROM OLD.parental_pin THEN
    IF NEW.parental_pin NOT LIKE '$2a$%' AND NEW.parental_pin NOT LIKE '$2b$%' THEN
      NEW.parental_pin := crypt(NEW.parental_pin, gen_salt('bf', 10));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to hash credentials on insert/update
DROP TRIGGER IF EXISTS hash_profile_credentials_trigger ON public.profiles;
CREATE TRIGGER hash_profile_credentials_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_profile_credentials();

-- Create a secure function to verify a PIN code
CREATE OR REPLACE FUNCTION public.verify_pin_code(user_mobile TEXT, input_pin TEXT)
RETURNS TABLE(user_id UUID, is_valid BOOLEAN, is_locked BOOLEAN, lock_until TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF profile_record.pin_code = crypt(input_pin, profile_record.pin_code) THEN
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
$$;

-- Create a secure function to verify secret word for PIN reset
CREATE OR REPLACE FUNCTION public.verify_secret_word(user_mobile TEXT, input_secret TEXT)
RETURNS TABLE(user_id UUID, is_valid BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF profile_record.secret_word = crypt(input_secret, profile_record.secret_word) THEN
    RETURN QUERY SELECT profile_record.id, TRUE;
  ELSE
    RETURN QUERY SELECT profile_record.id, FALSE;
  END IF;
END;
$$;

-- Create a secure function to verify parental PIN
CREATE OR REPLACE FUNCTION public.verify_parental_pin(user_uuid UUID, input_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_pin TEXT;
BEGIN
  SELECT parental_pin INTO stored_pin
  FROM public.profiles
  WHERE id = user_uuid;
  
  IF stored_pin IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN stored_pin = crypt(input_pin, stored_pin);
END;
$$;