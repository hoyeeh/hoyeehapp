-- Fix: Add RLS policy to allow users to view their own email logs
-- This addresses the data transparency concern by letting users see what email tracking data is collected about them

-- Add policy for users to view their own email logs
CREATE POLICY "Users can view their own email logs"
ON public.email_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Note: Data retention policies are typically handled by scheduled jobs or application logic
-- rather than database constraints to allow for flexibility and legal compliance requirements