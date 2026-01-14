-- =============================================
-- FIX SECURITY ISSUES - January 14, 2026
-- =============================================

-- ===========================================
-- 1. FIX SECURITY DEFINER VIEWS
-- ===========================================
-- Views need to use SECURITY INVOKER (the default) to respect
-- the RLS policies of the querying user, not the view owner.
-- The current views are owned by 'postgres' which bypasses RLS.

-- 1.1 Recreate creator_profiles_public with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.creator_profiles_public;
CREATE VIEW public.creator_profiles_public
WITH (security_invoker = true)
AS SELECT 
    id,
    user_id,
    display_name,
    bio,
    avatar_url,
    cover_url,
    is_verified,
    is_active,
    follower_count,
    created_at,
    updated_at
FROM public.creator_profiles
WHERE is_active = true;

-- Grant appropriate access
GRANT SELECT ON public.creator_profiles_public TO anon, authenticated;

-- 1.2 Recreate profiles_safe with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker = true)
AS SELECT 
    id,
    display_name,
    avatar_url,
    country,
    is_subscribed,
    subscription_expiry,
    parental_controls_enabled,
    parental_rating_limit,
    created_at,
    updated_at,
    last_login_at,
    CASE
        WHEN mobile_number IS NOT NULL THEN '****' || RIGHT(mobile_number, 4)
        ELSE NULL
    END AS mobile_number_masked
FROM public.profiles;

-- Grant appropriate access (admins can view, users view own via underlying RLS)
GRANT SELECT ON public.profiles_safe TO authenticated;

-- 1.3 Recreate subscriptions_safe with explicit SECURITY INVOKER
DROP VIEW IF EXISTS public.subscriptions_safe;
CREATE VIEW public.subscriptions_safe
WITH (security_invoker = true)
AS SELECT 
    id,
    user_id,
    plan_type,
    status,
    starts_at,
    expires_at,
    created_at,
    updated_at
FROM public.subscriptions;

-- Grant appropriate access
GRANT SELECT ON public.subscriptions_safe TO authenticated;

-- ===========================================
-- 2. FIX OVERLY PERMISSIVE RLS POLICIES
-- ===========================================
-- The "Service can insert/update" policies apply to PUBLIC role,
-- meaning any authenticated user can use them. They should be 
-- restricted to service_role only OR use proper authorization.

-- 2.1 Fix cast_receivers: "Public can create receivers for pairing"
-- This allows anonymous pairing for TV cast feature - needs auth check
DROP POLICY IF EXISTS "Public can create receivers for pairing" ON public.cast_receivers;
CREATE POLICY "Authenticated can create receivers for pairing" 
ON public.cast_receivers
FOR INSERT
TO authenticated
WITH CHECK (
    -- Allow creating receivers without user_id for initial pairing
    user_id IS NULL 
    -- Or for own user
    OR user_id = auth.uid()
);

-- 2.2 Fix coming_soon_sync_log: "Service can insert sync logs"
-- This should only be accessible by admins/service role, not all users
DROP POLICY IF EXISTS "Service can insert sync logs" ON public.coming_soon_sync_log;
CREATE POLICY "Admins can insert sync logs" 
ON public.coming_soon_sync_log
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_super_admin(auth.uid())
);

-- 2.3 Fix content_purchases: "Service can insert purchases"
-- Only the purchasing user should be able to create their own purchase record
DROP POLICY IF EXISTS "Service can insert purchases" ON public.content_purchases;
CREATE POLICY "Users can create their own purchases" 
ON public.content_purchases
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2.4 Fix creator_analytics: "Service can insert/update analytics"
-- Only admins should be able to modify analytics
DROP POLICY IF EXISTS "Service can insert analytics" ON public.creator_analytics;
DROP POLICY IF EXISTS "Service can update analytics" ON public.creator_analytics;

CREATE POLICY "Admins can insert analytics" 
ON public.creator_analytics
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can update analytics" 
ON public.creator_analytics
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_super_admin(auth.uid())
);

-- 2.5 Fix creator_tips: "Service can insert/update tips"
-- Tippers should be able to insert their own tips
DROP POLICY IF EXISTS "Service can insert tips" ON public.creator_tips;
DROP POLICY IF EXISTS "Service can update tips" ON public.creator_tips;

CREATE POLICY "Users can create their own tips" 
ON public.creator_tips
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = tipper_user_id);

CREATE POLICY "Admins can update tips" 
ON public.creator_tips
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_super_admin(auth.uid())
);

-- 2.6 Fix email_logs: "Service can insert/update email logs"
-- Only admins should be able to modify email logs
DROP POLICY IF EXISTS "Service can insert email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Service can update email logs" ON public.email_logs;

CREATE POLICY "Admins can insert email logs" 
ON public.email_logs
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_super_admin(auth.uid())
);

CREATE POLICY "Admins can update email logs" 
ON public.email_logs
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR is_super_admin(auth.uid())
);

-- 2.7 Fix homepage_ads_events: "Anyone can insert events"
-- This is for analytics tracking - require authentication at minimum
DROP POLICY IF EXISTS "Anyone can insert events" ON public.homepage_ads_events;
CREATE POLICY "Authenticated users can insert analytics events" 
ON public.homepage_ads_events
FOR INSERT
TO authenticated
WITH CHECK (
    -- Users can only insert events with their own user_id or null (anonymous tracking)
    user_id IS NULL OR user_id = auth.uid()
);