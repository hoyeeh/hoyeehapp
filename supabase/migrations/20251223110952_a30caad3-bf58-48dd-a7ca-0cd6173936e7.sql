-- Fix cast_receivers table: Remove public read access, only allow viewing own devices or during active pairing
DROP POLICY IF EXISTS "Public can view receivers for pairing" ON public.cast_receivers;

-- Create a more restrictive policy for viewing receivers during pairing
-- Only allow viewing if: user owns it OR it's part of an active pending session they're trying to pair with
CREATE POLICY "Users can view receivers for active pairing sessions"
ON public.cast_receivers
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (user_id IS NULL AND EXISTS (
    SELECT 1 FROM public.cast_sessions cs 
    WHERE cs.receiver_id = cast_receivers.id 
    AND cs.status = 'pending'
    AND cs.expires_at > now()
  ))
);

-- Fix profiles table: Remove any public read policies and ensure only owner/admin access

-- First, drop all existing SELECT policies on profiles to start fresh
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create proper restrictive policies for profiles

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view all profiles (for user management)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Super admins can view all profiles (for sensitive operations)
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Users can update their own profile (ensure this exists)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Admins can update profiles for user management
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure profiles table has RLS enabled (should already be, but confirm)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;