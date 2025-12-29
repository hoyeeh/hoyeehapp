-- Enable pgcrypto extension for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Drop and recreate the function with proper schema reference
DROP FUNCTION IF EXISTS public.generate_secure_session_id();

CREATE OR REPLACE FUNCTION public.generate_secure_session_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(extensions.gen_random_bytes(16), 'hex');
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_secure_session_id() TO authenticated;