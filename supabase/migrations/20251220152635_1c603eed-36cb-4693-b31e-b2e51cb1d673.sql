-- Update handle_new_user with input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  validated_display_name TEXT;
BEGIN
  -- Validate and sanitize display_name
  validated_display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email);
  
  -- Enforce max length of 100 characters
  IF LENGTH(validated_display_name) > 100 THEN
    validated_display_name := LEFT(validated_display_name, 100);
  END IF;
  
  -- Remove any potentially dangerous characters (basic sanitization)
  validated_display_name := REGEXP_REPLACE(validated_display_name, '[<>"\''`;]', '', 'g');
  
  -- Ensure not empty after sanitization
  IF validated_display_name IS NULL OR TRIM(validated_display_name) = '' THEN
    validated_display_name := 'User';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, validated_display_name);
  
  RETURN NEW;
END;
$$;