-- Fix the security definer view warning by explicitly setting SECURITY INVOKER
-- This ensures the view respects the RLS policies of the querying user
ALTER VIEW public.profiles_safe SET (security_invoker = on);