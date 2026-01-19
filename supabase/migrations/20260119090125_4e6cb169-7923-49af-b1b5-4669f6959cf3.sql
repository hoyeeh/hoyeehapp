-- Update profiles_safe view to include a flag indicating if parental_pin is set
-- This allows checking if parental controls are configured without exposing the actual PIN

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
    active_session_id,
    -- Add a boolean flag indicating if parental_pin is set (without exposing the value)
    (parental_pin IS NOT NULL) AS has_parental_pin
FROM public.profiles;