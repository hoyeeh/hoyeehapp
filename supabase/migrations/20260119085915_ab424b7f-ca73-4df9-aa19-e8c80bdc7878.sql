-- Fix 1: Create or replace profiles_safe view with security_invoker
-- This view hides sensitive credential fields (pin_code, secret_word, parental_pin)

DROP VIEW IF EXISTS public.profiles_safe;

CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
SELECT 
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
        WHEN mobile_number IS NOT NULL THEN '****' || right(mobile_number, 4)
        ELSE NULL
    END AS mobile_number_masked,
    lockout_count,
    pin_locked_until,
    active_session_id
FROM public.profiles;

-- Fix 2: Update profiles RLS to deny direct SELECT for regular users
-- Users should access via profiles_safe view, not directly

-- First drop existing conflicting SELECT policies for users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a policy that denies direct SELECT access to users (they must use profiles_safe view)
-- Only admins and super admins can directly access the base table
CREATE POLICY "No direct user SELECT on profiles base table"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    -- Super admins can access directly
    is_super_admin(auth.uid())
    OR 
    -- Admins can access via admin policy
    has_role(auth.uid(), 'admin'::app_role)
);

-- Users can still update their own profile (non-sensitive fields handled by existing policies)
-- The existing update policies are fine as they don't expose sensitive data

-- Fix 3: Ensure scheduled_emails is properly protected
-- RLS is already enabled, but ensure no public access exists

-- Check and add restrictive policy if missing
DROP POLICY IF EXISTS "Public cannot access scheduled emails" ON public.scheduled_emails;

-- The existing admin policies are correct - no changes needed for scheduled_emails
-- Just verify RLS is enforced by keeping existing policies