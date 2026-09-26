-- Receiver credential (hash only) + claim timestamp
ALTER TABLE public.cast_sessions
  ADD COLUMN IF NOT EXISTS receiver_secret_hash text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS cast_sessions_pending_code_uq
  ON public.cast_sessions (pairing_code) WHERE status = 'pending';

-- Least privilege: only the owning controller (and admins) can read sessions.
-- All writes go through the cast-signaling function (service role).
DROP POLICY IF EXISTS "Anyone can create pending sessions" ON public.cast_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.cast_sessions;
DROP POLICY IF EXISTS "Users can view own or unpaired pending sessions" ON public.cast_sessions;
CREATE POLICY "Controllers can view own sessions" ON public.cast_sessions
  FOR SELECT TO authenticated
  USING (controller_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
REVOKE INSERT, UPDATE ON public.cast_sessions FROM anon, authenticated;
REVOKE ALL ON public.cast_sessions FROM anon;
GRANT SELECT, DELETE ON public.cast_sessions TO authenticated;
GRANT ALL ON public.cast_sessions TO service_role;

DROP POLICY IF EXISTS "Users can view receivers for active pairing sessions" ON public.cast_receivers;
DROP POLICY IF EXISTS "Authenticated can create receivers for pairing" ON public.cast_receivers;
REVOKE ALL ON public.cast_receivers FROM anon;

-- Durable rate limiting
CREATE TABLE IF NOT EXISTS public.cast_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cast_rate_limits TO service_role;
ALTER TABLE public.cast_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cast_rate_limit_hit(_key text, _max integer, _window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  INSERT INTO public.cast_rate_limits AS r (key, count, window_start)
  VALUES (_key, 1, now())
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN 1 ELSE r.count + 1 END,
    window_start = CASE WHEN r.window_start < now() - make_interval(secs => _window_seconds) THEN now() ELSE r.window_start END
  RETURNING count INTO v_count;
  RETURN v_count <= _max;
END $$;

-- Atomic single-use claim of a pending pairing code
CREATE OR REPLACE FUNCTION public.cast_claim_pairing(_code text, _user_id uuid)
RETURNS TABLE(session_id uuid, receiver_id uuid, device_name text, device_type text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE public.cast_sessions s
       SET status = 'paired', controller_user_id = _user_id, claimed_at = now(),
           last_heartbeat = now(), expires_at = now() + interval '12 hours'
     WHERE s.pairing_code = upper(_code) AND s.status = 'pending'
       AND s.expires_at > now() AND s.controller_user_id IS NULL
    RETURNING s.id, s.receiver_id
  )
  SELECT c.id, c.receiver_id, r.device_name::text, r.device_type::text
    FROM claimed c LEFT JOIN public.cast_receivers r ON r.id = c.receiver_id;
END $$;

-- Atomic command sequencing, ownership + state enforced in one statement
CREATE OR REPLACE FUNCTION public.cast_apply_command(_session_id uuid, _user_id uuid, _command text, _patch jsonb, _bump boolean)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq bigint;
BEGIN
  UPDATE public.cast_sessions s SET
    command_seq = CASE WHEN _bump THEN COALESCE(s.command_seq,0) + 1 ELSE s.command_seq END,
    command_type = CASE WHEN _bump THEN _command ELSE s.command_type END,
    command_payload = CASE WHEN _bump THEN COALESCE(_patch->'command_payload','{}'::jsonb) ELSE s.command_payload END,
    command_updated_at = CASE WHEN _bump THEN now() ELSE s.command_updated_at END,
    status = CASE WHEN _patch ? 'status' THEN _patch->>'status' ELSE s.status END,
    video_url = CASE WHEN _patch ? 'video_url' THEN _patch->>'video_url' ELSE s.video_url END,
    video_title = CASE WHEN _patch ? 'video_title' THEN _patch->>'video_title' ELSE s.video_title END,
    video_thumbnail = CASE WHEN _patch ? 'video_thumbnail' THEN _patch->>'video_thumbnail' ELSE s.video_thumbnail END,
    playback_time = CASE WHEN _patch ? 'playback_time' THEN (_patch->>'playback_time')::numeric ELSE s.playback_time END,
    video_duration = CASE WHEN _patch ? 'video_duration' THEN (_patch->>'video_duration')::numeric ELSE s.video_duration END,
    is_playing = CASE WHEN _patch ? 'is_playing' THEN (_patch->>'is_playing')::boolean ELSE s.is_playing END,
    volume_level = CASE WHEN _patch ? 'volume_level' THEN (_patch->>'volume_level')::integer ELSE s.volume_level END,
    queue = CASE WHEN _patch ? 'queue' THEN _patch->'queue' ELSE s.queue END,
    controller_last_heartbeat = now()
  WHERE s.id = _session_id AND s.controller_user_id = _user_id
    AND s.status IN ('paired','active') AND s.expires_at > now()
  RETURNING s.command_seq INTO v_seq;
  RETURN v_seq; -- NULL => not found / not owner / not live
END $$;

-- ACK: only for the current command seq, only once, only by the credentialed receiver
CREATE OR REPLACE FUNCTION public.cast_record_ack(_session_id uuid, _secret_hash text, _seq bigint, _status text, _error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF _status NOT IN ('success','error') THEN RETURN false; END IF;
  UPDATE public.cast_sessions s SET
    last_acked_seq = _seq, last_ack_status = _status,
    last_ack_error = CASE WHEN _status = 'error' THEN left(COALESCE(_error,'Unknown error'), 500) ELSE NULL END,
    last_ack_at = now()
  WHERE s.id = _session_id AND s.receiver_secret_hash = _secret_hash
    AND s.status IN ('paired','active') AND s.expires_at > now()
    AND s.command_seq = _seq AND COALESCE(s.last_acked_seq, 0) < _seq
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END $$;

REVOKE ALL ON FUNCTION public.cast_rate_limit_hit(text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cast_claim_pairing(text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cast_apply_command(uuid,uuid,text,jsonb,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cast_record_ack(uuid,text,bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cast_rate_limit_hit(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_claim_pairing(text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_apply_command(uuid,uuid,text,jsonb,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.cast_record_ack(uuid,text,bigint,text,text) TO service_role;

-- Invalidate legacy sessions that have no receiver credential
UPDATE public.cast_sessions SET status = 'disconnected', video_url = NULL
 WHERE receiver_secret_hash IS NULL AND status IN ('pending','paired','active');