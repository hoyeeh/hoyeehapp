
-- Fix subscriptions RLS policies to target 'authenticated' role instead of 'public'
-- This prevents anonymous users from potentially accessing subscription data

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admins can update all subscriptions" ON public.subscriptions;

-- Recreate with authenticated role
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Super admins can update all subscriptions"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));
