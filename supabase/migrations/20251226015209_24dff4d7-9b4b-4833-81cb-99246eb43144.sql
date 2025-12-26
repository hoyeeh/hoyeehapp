-- Fix rate_limits table: Block all direct user access (service role only)
DROP POLICY IF EXISTS "Rate limits are managed by system" ON public.rate_limits;

CREATE POLICY "Service role only" ON public.rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Fix cast_sessions table: Add expiry checks to SELECT policy
DROP POLICY IF EXISTS "Users can view pending or own sessions" ON public.cast_sessions;

CREATE POLICY "Users can view pending or own sessions" ON public.cast_sessions
  FOR SELECT
  USING (
    (controller_user_id = auth.uid()) 
    OR 
    (status = 'pending' AND expires_at > now())
  );

-- Fix cast_sessions table: Add expiry checks to UPDATE policy
DROP POLICY IF EXISTS "Users can update own sessions" ON public.cast_sessions;

CREATE POLICY "Users can update own sessions" ON public.cast_sessions
  FOR UPDATE
  USING (
    (controller_user_id = auth.uid()) 
    OR 
    (controller_user_id IS NULL AND status = 'pending' AND expires_at > now())
  );