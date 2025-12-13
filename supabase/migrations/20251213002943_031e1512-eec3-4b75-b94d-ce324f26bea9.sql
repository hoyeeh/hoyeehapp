-- Move pgcrypto extension from public schema to extensions schema
-- First, drop the extension from public schema
DROP EXTENSION IF EXISTS pgcrypto;

-- Create the extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Recreate the extension in the extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update the hash_profile_credentials function to use the new schema location
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