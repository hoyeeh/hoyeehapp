
-- Tighten cast_sessions SELECT policy to prevent leaking video_url across users.
-- Pending sessions remain readable (needed for TV/receiver pairing flow) ONLY when
-- they contain no premium video URL yet. Once a video is loaded, the session
-- status moves past 'pending' and only the controller can read it.

DROP POLICY IF EXISTS "Users can view pending or own sessions" ON public.cast_sessions;

CREATE POLICY "Users can view own or unpaired pending sessions"
ON public.cast_sessions
FOR SELECT
USING (
  controller_user_id = auth.uid()
  OR (
    status = 'pending'
    AND expires_at > now()
    AND video_url IS NULL
  )
);

-- Enforce at write time: a pending session must never carry a video_url.
CREATE OR REPLACE FUNCTION public.enforce_pending_cast_session_no_video()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.video_url IS NOT NULL THEN
    RAISE EXCEPTION 'Pending cast sessions cannot carry a video_url';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pending_cast_session_no_video ON public.cast_sessions;
CREATE TRIGGER trg_enforce_pending_cast_session_no_video
BEFORE INSERT OR UPDATE ON public.cast_sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_pending_cast_session_no_video();
