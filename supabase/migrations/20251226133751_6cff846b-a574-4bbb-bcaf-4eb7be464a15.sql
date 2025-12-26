-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.join_watch_party_by_code(text);

-- Recreate with has_started in return type
CREATE OR REPLACE FUNCTION public.join_watch_party_by_code(party_code text)
 RETURNS TABLE(party_id uuid, content_id text, episode_id text, host_user_id uuid, playback_time numeric, is_playing boolean, party_code_out character varying, has_started boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  found_party RECORD;
  calling_user_id UUID;
BEGIN
  calling_user_id := auth.uid();

  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to join a watch party';
  END IF;

  -- Find the active party by code (case-insensitive)
  SELECT wp.*
  INTO found_party
  FROM public.watch_parties wp
  WHERE UPPER(wp.party_code) = UPPER(join_watch_party_by_code.party_code)
    AND wp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Watch party not found or no longer active';
  END IF;

  -- Prevent joining if party has already started
  IF found_party.has_started = true THEN
    RAISE EXCEPTION 'Cannot join: Watch party has already started. No new members can join once playback begins.';
  END IF;

  -- Idempotent join: update existing membership; if none, insert
  UPDATE public.watch_party_members wpm
  SET joined_at = now()
  WHERE wpm.party_id = found_party.id
    AND wpm.user_id = calling_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.watch_party_members (party_id, user_id, is_ready)
    VALUES (found_party.id, calling_user_id, false);
  END IF;

  RETURN QUERY
  SELECT
    found_party.id AS party_id,
    found_party.content_id::text AS content_id,
    found_party.episode_id::text AS episode_id,
    found_party.host_user_id,
    found_party.playback_time::numeric AS playback_time,
    found_party.is_playing,
    found_party.party_code AS party_code_out,
    found_party.has_started;
END;
$function$;