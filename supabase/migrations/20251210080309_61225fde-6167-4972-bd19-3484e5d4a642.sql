-- Drop existing overly permissive RLS policies on cast_sessions
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.cast_sessions;
DROP POLICY IF EXISTS "Anyone can delete sessions" ON public.cast_sessions;
DROP POLICY IF EXISTS "Anyone can update sessions" ON public.cast_sessions;
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.cast_sessions;

-- Create secure RLS policies for cast_sessions
-- Allow viewing pending sessions (for pairing) or own sessions
CREATE POLICY "Users can view pending or own sessions" 
ON public.cast_sessions 
FOR SELECT 
USING (status = 'pending' OR controller_user_id = auth.uid());

-- Allow creating sessions (for receivers and authenticated users)
CREATE POLICY "Anyone can create pending sessions" 
ON public.cast_sessions 
FOR INSERT 
WITH CHECK (status = 'pending' OR controller_user_id = auth.uid());

-- Only session owners can update their sessions
CREATE POLICY "Users can update own sessions" 
ON public.cast_sessions 
FOR UPDATE 
USING (controller_user_id = auth.uid() OR (controller_user_id IS NULL AND status = 'pending'));

-- Only session owners can delete their sessions
CREATE POLICY "Users can delete own sessions" 
ON public.cast_sessions 
FOR DELETE 
USING (controller_user_id = auth.uid());