-- Add 'creator' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'creator';

-- Create creator_applications table
CREATE TABLE public.creator_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  portfolio_url TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  UNIQUE(user_id)
);

-- Create creator_profiles table
CREATE TABLE public.creator_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  payout_method TEXT CHECK (payout_method IN ('mobile_money', 'bank_transfer', 'paypal')),
  payout_details JSONB DEFAULT '{}'::jsonb,
  total_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create paid_content table (extends content with pricing)
CREATE TABLE public.paid_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL UNIQUE REFERENCES public.content(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sale_count INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create content_purchases table
CREATE TABLE public.content_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  paid_content_id UUID NOT NULL REFERENCES public.paid_content(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  creator_share NUMERIC(12, 2) NOT NULL,
  platform_share NUMERIC(12, 2) NOT NULL,
  payment_provider TEXT NOT NULL,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Create creator_payouts table
CREATE TABLE public.creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  payout_method TEXT NOT NULL CHECK (payout_method IN ('mobile_money', 'bank_transfer', 'paypal')),
  payout_details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  flutterwave_ref TEXT,
  error_message TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  notes TEXT
);

-- Create platform_settings table for commission configuration
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default platform settings
INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
  ('creator_commission_percent', '70', 'Percentage of sale that goes to the creator'),
  ('platform_commission_percent', '30', 'Percentage of sale that goes to the platform'),
  ('minimum_payout_amount', '5000', 'Minimum amount (XAF) required for payout request'),
  ('minimum_content_price', '500', 'Minimum price (XAF) for paid content');

-- Enable RLS on all tables
ALTER TABLE public.creator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paid_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for creator_applications

-- Users can view their own application
CREATE POLICY "Users can view their own application"
ON public.creator_applications FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own application
CREATE POLICY "Users can create their own application"
ON public.creator_applications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their pending application
CREATE POLICY "Users can update their pending application"
ON public.creator_applications FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all applications
CREATE POLICY "Admins can view all applications"
ON public.creator_applications FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update applications (approve/reject)
CREATE POLICY "Admins can update applications"
ON public.creator_applications FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete applications
CREATE POLICY "Admins can delete applications"
ON public.creator_applications FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for creator_profiles

-- Anyone can view active creator profiles (for public profile pages)
CREATE POLICY "Anyone can view active creator profiles"
ON public.creator_profiles FOR SELECT
USING (is_active = true);

-- Creators can view their own profile (even if inactive)
CREATE POLICY "Creators can view own profile"
ON public.creator_profiles FOR SELECT
USING (auth.uid() = user_id);

-- Creators can update their own profile
CREATE POLICY "Creators can update own profile"
ON public.creator_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all creator profiles
CREATE POLICY "Admins can view all creator profiles"
ON public.creator_profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update any creator profile
CREATE POLICY "Admins can update any creator profile"
ON public.creator_profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can insert creator profiles (when approving applications)
CREATE POLICY "Admins can insert creator profiles"
ON public.creator_profiles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for paid_content

-- Anyone can view active paid content
CREATE POLICY "Anyone can view active paid content"
ON public.paid_content FOR SELECT
USING (is_active = true);

-- Creators can view their own paid content
CREATE POLICY "Creators can view own paid content"
ON public.paid_content FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.creator_profiles cp 
  WHERE cp.id = paid_content.creator_id AND cp.user_id = auth.uid()
));

-- Creators can insert their own paid content
CREATE POLICY "Creators can insert paid content"
ON public.paid_content FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.creator_profiles cp 
  WHERE cp.id = paid_content.creator_id AND cp.user_id = auth.uid()
));

-- Creators can update their own paid content
CREATE POLICY "Creators can update paid content"
ON public.paid_content FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.creator_profiles cp 
  WHERE cp.id = paid_content.creator_id AND cp.user_id = auth.uid()
));

-- Creators can delete their own paid content
CREATE POLICY "Creators can delete paid content"
ON public.paid_content FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.creator_profiles cp 
  WHERE cp.id = paid_content.creator_id AND cp.user_id = auth.uid()
));

-- Admins can manage all paid content
CREATE POLICY "Admins can view all paid content"
ON public.paid_content FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all paid content"
ON public.paid_content FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all paid content"
ON public.paid_content FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for content_purchases

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases"
ON public.content_purchases FOR SELECT
USING (auth.uid() = user_id);

-- Creators can view purchases of their content
CREATE POLICY "Creators can view their content purchases"
ON public.content_purchases FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.creator_profiles cp 
  WHERE cp.id = content_purchases.creator_id AND cp.user_id = auth.uid()
));

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
ON public.content_purchases FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Service can insert purchases (via edge function)
CREATE POLICY "Service can insert purchases"
ON public.content_purchases FOR INSERT
WITH CHECK (true);

-- Admins can update purchases (for refunds)
CREATE POLICY "Admins can update purchases"
ON public.content_purchases FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for creator_payouts

-- Creators can view their own payouts
CREATE POLICY "Creators can view own payouts"
ON public.creator_payouts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.creator_profiles cp 
  WHERE cp.id = creator_payouts.creator_id AND cp.user_id = auth.uid()
));

-- Creators can request payouts (insert)
CREATE POLICY "Creators can request payouts"
ON public.creator_payouts FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.creator_profiles cp 
  WHERE cp.id = creator_payouts.creator_id AND cp.user_id = auth.uid()
));

-- Creators can cancel their pending payouts
CREATE POLICY "Creators can cancel pending payouts"
ON public.creator_payouts FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.creator_profiles cp 
    WHERE cp.id = creator_payouts.creator_id AND cp.user_id = auth.uid()
  ) AND status = 'pending'
);

-- Admins can view all payouts
CREATE POLICY "Admins can view all payouts"
ON public.creator_payouts FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update payouts (approve/process)
CREATE POLICY "Admins can update payouts"
ON public.creator_payouts FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete payouts
CREATE POLICY "Admins can delete payouts"
ON public.creator_payouts FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for platform_settings

-- Anyone can view platform settings (public config)
CREATE POLICY "Anyone can view platform settings"
ON public.platform_settings FOR SELECT
USING (true);

-- Only admins can update platform settings
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert platform settings
CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only super admins can delete platform settings
CREATE POLICY "Super admins can delete platform settings"
ON public.platform_settings FOR DELETE
USING (is_super_admin(auth.uid()));

-- Create helper function to check if user is a creator
CREATE OR REPLACE FUNCTION public.is_creator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.creator_profiles
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;

-- Create helper function to check if user has purchased content
CREATE OR REPLACE FUNCTION public.has_purchased_content(_user_id uuid, _content_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.content_purchases
    WHERE user_id = _user_id
      AND content_id = _content_id
      AND status = 'completed'
  )
$$;

-- Create function to get creator profile by user id
CREATE OR REPLACE FUNCTION public.get_creator_profile(_user_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  bio text,
  avatar_url text,
  total_earnings numeric,
  pending_balance numeric,
  is_verified boolean
)
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
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id ON public.creator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON public.creator_applications(status);
CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id ON public.creator_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_paid_content_creator_id ON public.paid_content(creator_id);
CREATE INDEX IF NOT EXISTS idx_paid_content_content_id ON public.paid_content(content_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_user_id ON public.content_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_content_purchases_creator_id ON public.content_purchases(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_creator_id ON public.creator_payouts(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_status ON public.creator_payouts(status);

-- Trigger to update updated_at on creator_profiles
CREATE TRIGGER update_creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to update updated_at on paid_content
CREATE TRIGGER update_paid_content_updated_at
  BEFORE UPDATE ON public.paid_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();