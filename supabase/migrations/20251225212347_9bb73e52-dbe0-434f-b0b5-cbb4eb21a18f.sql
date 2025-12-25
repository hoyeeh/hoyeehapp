-- Create a secure function to join watch party by code
-- This bypasses RLS issues by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.join_watch_party_by_code(party_code TEXT)
RETURNS TABLE (
  party_id UUID,
  content_id TEXT,
  episode_id TEXT,
  host_user_id UUID,
  playback_time NUMERIC,
  is_playing BOOLEAN,
  party_code_out VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_party RECORD;
  calling_user_id UUID;
BEGIN
  -- Get the authenticated user
  calling_user_id := auth.uid();
  
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to join a watch party';
  END IF;
  
  -- Find the active party by code (case-insensitive)
  SELECT wp.* INTO found_party
  FROM watch_parties wp
  WHERE UPPER(wp.code) = UPPER(party_code)
    AND wp.is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Watch party not found or no longer active';
  END IF;
  
  -- Insert or update the membership
  INSERT INTO watch_party_members (party_id, user_id, is_ready)
  VALUES (found_party.id, calling_user_id, false)
  ON CONFLICT (party_id, user_id) 
  DO UPDATE SET joined_at = NOW();
  
  -- Return the party details
  RETURN QUERY
  SELECT 
    found_party.id,
    found_party.content_id,
    found_party.episode_id,
    found_party.host_user_id,
    found_party.current_time,
    found_party.is_playing,
    found_party.code;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.join_watch_party_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_watch_party_by_code(TEXT) TO authenticated;