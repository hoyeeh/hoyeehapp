-- Create a secure view for profiles that excludes sensitive fields
-- This view should be used by client-side queries instead of direct table access

CREATE OR REPLACE VIEW public.profiles_safe AS
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
  last_login_at
  -- Excluded: mobile_number, pin_code, secret_word, parental_pin, pin_attempts, pin_locked_until, active_session_id
FROM public.profiles;

-- Create RLS policy for the view
ALTER VIEW public.profiles_safe SET (security_invoker = on);

-- Create a secure view for subscriptions that excludes sensitive payment fields
CREATE OR REPLACE VIEW public.subscriptions_safe AS
SELECT 
  id,
  user_id,
  plan_type,
  status,
  starts_at,
  expires_at,
  created_at,
  updated_at
  -- Excluded: payment_reference, payment_provider, amount, currency, discount_percent, discount_reason, admin_notes
FROM public.subscriptions;

-- Create RLS policy for the view
ALTER VIEW public.subscriptions_safe SET (security_invoker = on);

-- Create a function to check if mobile number exists (without exposing it)
CREATE OR REPLACE FUNCTION public.check_mobile_exists(check_mobile TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE mobile_number = check_mobile
  );
END;
$$;

-- Create a function to get masked mobile number (last 4 digits only)
CREATE OR REPLACE FUNCTION public.get_masked_mobile(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  full_mobile TEXT;
BEGIN
  -- Only allow users to see their own masked mobile
  IF user_uuid != auth.uid() THEN
    RETURN NULL;
  END IF;
  
  SELECT mobile_number INTO full_mobile
  FROM public.profiles
  WHERE id = user_uuid;
  
  IF full_mobile IS NULL OR LENGTH(full_mobile) < 4 THEN
    RETURN NULL;
  END IF;
  
  -- Return masked version: ****1234
  RETURN '****' || RIGHT(full_mobile, 4);
END;
$$;

-- Create a function to update mobile number securely
CREATE OR REPLACE FUNCTION public.update_mobile_number(new_mobile TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate mobile format
  IF new_mobile IS NULL OR LENGTH(new_mobile) < 8 THEN
    RETURN FALSE;
  END IF;
  
  -- Check if mobile already exists for another user
  IF EXISTS (SELECT 1 FROM public.profiles WHERE mobile_number = new_mobile AND id != auth.uid()) THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.profiles
  SET mobile_number = new_mobile, updated_at = NOW()
  WHERE id = auth.uid();
  
  RETURN TRUE;
END;
$$;

-- Create a function to get subscription summary (without exposing payment details)
CREATE OR REPLACE FUNCTION public.get_subscription_summary(user_uuid UUID)
RETURNS TABLE(
  plan_type TEXT,
  status TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to see their own subscription or admins to see any
  IF user_uuid != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    s.plan_type,
    s.status,
    s.starts_at,
    s.expires_at,
    (s.status = 'active' AND (s.expires_at IS NULL OR s.expires_at > NOW())) AS is_active
  FROM public.subscriptions s
  WHERE s.user_id = user_uuid
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;