-- =====================================================
-- FIX 1: Add explicit auth check to get_creator_profile
-- =====================================================
-- Update get_creator_profile to ensure callers can only access their own profile
-- or admins can access any profile (defense in depth)

CREATE OR REPLACE FUNCTION public.get_creator_profile(_user_id uuid)
RETURNS TABLE(id uuid, display_name text, bio text, avatar_url text, total_earnings numeric, pending_balance numeric, is_verified boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cp.id,
    cp.display_name,
    cp.bio,
    cp.avatar_url,
    cp.total_earnings,
    cp.pending_balance,
    cp.is_verified
  FROM public.creator_profiles cp
  WHERE cp.user_id = _user_id
    AND cp.is_active = true
    -- Explicit authorization check: only allow the owner or admins
    AND (
      _user_id = auth.uid() 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'super_admin')
    )
$$;

-- =====================================================
-- FIX 2: Server-side cryptographic session ID generation
-- =====================================================
-- Create function to generate cryptographically secure session IDs

CREATE OR REPLACE FUNCTION public.generate_secure_session_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id text;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to generate session ID';
  END IF;
  
  -- Generate cryptographically secure session ID using pgcrypto
  -- Format: base64(sha256(user_id + random_uuid + timestamp + random_bytes))
  v_session_id := encode(
    extensions.digest(
      v_user_id::text || gen_random_uuid()::text || now()::text || gen_random_bytes(32)::text,
      'sha256'
    ),
    'hex'
  );
  
  -- Update the user's active session
  UPDATE profiles 
  SET active_session_id = v_session_id,
      last_login_at = now()
  WHERE id = v_user_id;
  
  RETURN v_session_id;
END;
$$;

-- Create function to validate session (used for checking if session is still valid)
CREATE OR REPLACE FUNCTION public.validate_session(session_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE id = auth.uid() 
    AND active_session_id = session_id
  );
$$;

-- Create function to clear session on logout
CREATE OR REPLACE FUNCTION public.clear_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to clear session';
  END IF;
  
  UPDATE profiles 
  SET active_session_id = NULL
  WHERE id = auth.uid();
END;
$$;