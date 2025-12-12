-- Fix 1: Restrict admin UPDATE on profiles to super_admins only
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Super admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Fix 2: Restrict admin UPDATE on subscriptions to super_admins only
DROP POLICY IF EXISTS "Admins can update all subscriptions" ON public.subscriptions;

CREATE POLICY "Super admins can update all subscriptions"
ON public.subscriptions
FOR UPDATE
USING (is_super_admin(auth.uid()));