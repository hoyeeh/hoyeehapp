DROP POLICY IF EXISTS "Users can view pending or own sessions" ON public.cast_sessions;
CREATE POLICY "Users can view pending or own sessions"
ON public.cast_sessions
FOR SELECT
TO authenticated
USING (
  controller_user_id = auth.uid()
  OR (status = 'pending' AND expires_at > now())
);