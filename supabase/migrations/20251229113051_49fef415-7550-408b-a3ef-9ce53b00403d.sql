-- Fix: Remove public access to financial data from creator_profiles RLS policy
-- The condition "OR is_active = true" allowed any authenticated user to see all active creator profiles
-- including sensitive financial data (total_earnings, pending_balance, payout_details)

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Owners and admins can view full creator profiles" ON public.creator_profiles;

-- Create a properly restrictive policy that only allows owners and admins
CREATE POLICY "Owners and admins can view full creator profiles"
ON public.creator_profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  -- REMOVED: OR is_active = true (was exposing financial data to all users)
);

-- Note: Public access to creator profiles (without financial data) should use 
-- the creator_profiles_public view which already excludes sensitive columns