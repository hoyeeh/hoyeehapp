-- Create subscription_settings table for admin to configure pricing
CREATE TABLE public.subscription_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_type text NOT NULL UNIQUE DEFAULT 'monthly',
  base_price numeric NOT NULL DEFAULT 2000,
  currency text NOT NULL DEFAULT 'XAF',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can view subscription settings (needed for pricing display)
CREATE POLICY "Anyone can view subscription settings" 
ON public.subscription_settings 
FOR SELECT 
USING (true);

-- Only admins can modify subscription settings
CREATE POLICY "Admins can insert subscription settings" 
ON public.subscription_settings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subscription settings" 
ON public.subscription_settings 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subscription settings" 
ON public.subscription_settings 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Add discount columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS discount_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_reason text,
ADD COLUMN IF NOT EXISTS admin_notes text;

-- Insert default monthly plan
INSERT INTO public.subscription_settings (plan_type, base_price, currency, description)
VALUES ('monthly', 2000, 'XAF', 'Monthly subscription with full access to premium content')
ON CONFLICT (plan_type) DO NOTHING;

-- Create trigger for updated_at on subscription_settings
CREATE TRIGGER update_subscription_settings_updated_at
BEFORE UPDATE ON public.subscription_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();