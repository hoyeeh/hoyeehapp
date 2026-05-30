
-- Fix generate_secure_session_id to actually persist the session id on the user's profile.
-- Previous version only returned a random hex string, leaving active_session_id NULL forever
-- which silently disabled the single-device enforcement.

CREATE OR REPLACE FUNCTION public.generate_secure_session_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  new_session_id TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to generate a session id';
  END IF;

  new_session_id := encode(extensions.gen_random_bytes(16), 'hex');

  UPDATE public.profiles
     SET active_session_id = new_session_id,
         last_login_at = NOW()
   WHERE id = auth.uid();

  RETURN new_session_id;
END;
$function$;

-- Make sure realtime can broadcast active_session_id changes so other devices
-- detect takeover instantly.
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
