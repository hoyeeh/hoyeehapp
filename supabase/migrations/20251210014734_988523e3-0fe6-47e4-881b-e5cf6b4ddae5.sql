-- Add mobile number, PIN code, and secret word fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mobile_number text,
ADD COLUMN IF NOT EXISTS pin_code text,
ADD COLUMN IF NOT EXISTS secret_word text,
ADD COLUMN IF NOT EXISTS pin_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS pin_locked_until timestamp with time zone;

-- Create index on mobile_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_mobile_number ON public.profiles(mobile_number);

-- Add policy for admins to update any profile (for secret word reset)
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));