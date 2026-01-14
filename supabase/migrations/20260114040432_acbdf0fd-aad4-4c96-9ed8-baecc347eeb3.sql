-- =============================================
-- FIX REMAINING OVERLY PERMISSIVE RLS POLICIES - RETRY
-- =============================================
-- Drop existing overlapping policies first, then drop the problematic ones

-- ===========================================
-- 1. FIX cast_events: Drop the always-true policy
-- ===========================================
DROP POLICY IF EXISTS "Service role can manage cast_events" ON public.cast_events;
DROP POLICY IF EXISTS "Users can view their session events" ON public.cast_events;
DROP POLICY IF EXISTS "Users can insert events for their sessions" ON public.cast_events;
DROP POLICY IF EXISTS "Users can view events for their sessions" ON public.cast_events;
DROP POLICY IF EXISTS "Admins can manage cast events" ON public.cast_events;

-- Recreate with proper policies
CREATE POLICY "Users can insert events for their sessions" 
ON public.cast_events
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM cast_sessions cs
        WHERE cs.id = cast_events.session_id
        AND (cs.controller_user_id = auth.uid() OR cs.receiver_id IN (
            SELECT cr.id FROM cast_receivers cr WHERE cr.user_id = auth.uid()
        ))
    )
);

CREATE POLICY "Users can view events for their sessions" 
ON public.cast_events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM cast_sessions cs
        WHERE cs.id = cast_events.session_id
        AND (cs.controller_user_id = auth.uid() OR cs.receiver_id IN (
            SELECT cr.id FROM cast_receivers cr WHERE cr.user_id = auth.uid()
        ))
    )
    OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can manage cast events" 
ON public.cast_events
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- ===========================================
-- 2. FIX content_lifecycle_logs: Drop the always-true policy
-- ===========================================
DROP POLICY IF EXISTS "Service can manage lifecycle logs" ON public.content_lifecycle_logs;
-- Keep existing admin policies: "Admins can insert lifecycle logs", "Admins can view all lifecycle logs"

-- ===========================================
-- 3. FIX creator_reports: Drop the always-true policy
-- ===========================================
DROP POLICY IF EXISTS "Service can manage reports" ON public.creator_reports;
DROP POLICY IF EXISTS "Admins can insert reports" ON public.creator_reports;
DROP POLICY IF EXISTS "Admins can update reports" ON public.creator_reports;
DROP POLICY IF EXISTS "Admins can delete reports" ON public.creator_reports;
-- Keep existing: "Admins can view all reports", "Creators can view their reports"

-- Add missing admin modification policies
CREATE POLICY "Admins can insert reports" 
ON public.creator_reports
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update reports" 
ON public.creator_reports
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete reports" 
ON public.creator_reports
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- ===========================================
-- 4. FIX kyc_access_logs: Drop the always-true policy
-- ===========================================
DROP POLICY IF EXISTS "Service role can manage KYC audit logs" ON public.kyc_access_logs;
DROP POLICY IF EXISTS "Super admins can manage KYC access logs" ON public.kyc_access_logs;
-- Keep existing: "Super admins can insert KYC audit logs", "Super admins can view KYC audit logs"

-- Add update/delete policies for super admins only
CREATE POLICY "Super admins can update KYC access logs" 
ON public.kyc_access_logs
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete KYC access logs" 
ON public.kyc_access_logs
FOR DELETE
TO authenticated
USING (is_super_admin(auth.uid()));

-- ===========================================
-- 5. FIX scheduled_emails: Drop the always-true policy
-- ===========================================
DROP POLICY IF EXISTS "Service role can manage scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Admins can manage scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Admins can insert scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Admins can update scheduled emails" ON public.scheduled_emails;
DROP POLICY IF EXISTS "Admins can delete scheduled emails" ON public.scheduled_emails;
-- Keep existing: "Admins can view scheduled emails"

CREATE POLICY "Admins can insert scheduled emails" 
ON public.scheduled_emails
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update scheduled emails" 
ON public.scheduled_emails
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can delete scheduled emails" 
ON public.scheduled_emails
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- ===========================================
-- 6. FIX subtitle_generation_logs: Drop the always-true policy
-- ===========================================
DROP POLICY IF EXISTS "Service role full access to subtitle generation logs" ON public.subtitle_generation_logs;
DROP POLICY IF EXISTS "Admins can insert subtitle generation logs" ON public.subtitle_generation_logs;
DROP POLICY IF EXISTS "Admins can update subtitle generation logs" ON public.subtitle_generation_logs;
-- Keep existing: "Admins can view subtitle generation logs"

CREATE POLICY "Admins can insert subtitle generation logs" 
ON public.subtitle_generation_logs
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can update subtitle generation logs" 
ON public.subtitle_generation_logs
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- ===========================================
-- 7. FIX user_drip_enrollments: Drop the always-true policy
-- ===========================================
DROP POLICY IF EXISTS "Service role can manage enrollments" ON public.user_drip_enrollments;
DROP POLICY IF EXISTS "Service can manage enrollments" ON public.user_drip_enrollments;
DROP POLICY IF EXISTS "Users can view their enrollments" ON public.user_drip_enrollments;
DROP POLICY IF EXISTS "Admins can manage enrollments" ON public.user_drip_enrollments;
-- Keep existing: "Admins can view enrollments"

-- Users can view their own enrollments
CREATE POLICY "Users can view their enrollments" 
ON public.user_drip_enrollments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can insert enrollments
CREATE POLICY "Admins can insert enrollments" 
ON public.user_drip_enrollments
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- Admins can update enrollments
CREATE POLICY "Admins can update enrollments" 
ON public.user_drip_enrollments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

-- Admins can delete enrollments
CREATE POLICY "Admins can delete enrollments" 
ON public.user_drip_enrollments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));