-- 1. Creator Followers table
CREATE TABLE public.creator_followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  follower_user_id UUID NOT NULL,
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, follower_user_id)
);

-- 2. Creator Tips table
CREATE TABLE public.creator_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  tipper_user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  message TEXT,
  payment_provider TEXT NOT NULL,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Creator Social Accounts (for content import)
CREATE TABLE public.creator_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'facebook', 'tiktok', 'instagram')),
  platform_user_id TEXT,
  platform_username TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);

-- 4. Creator Imported Content (from social platforms)
CREATE TABLE public.creator_imported_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES public.creator_social_accounts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  platform_content_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  duration INTEGER,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  original_published_at TIMESTAMPTZ,
  is_imported_to_content BOOLEAN NOT NULL DEFAULT false,
  imported_content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, platform_content_id)
);

-- 5. Creator Analytics (daily aggregates)
CREATE TABLE public.creator_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  unique_viewers INTEGER NOT NULL DEFAULT 0,
  watch_time_minutes INTEGER NOT NULL DEFAULT 0,
  new_followers INTEGER NOT NULL DEFAULT 0,
  sales INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  tips_received NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, date)
);

-- 6. Creator Reports (weekly/monthly)
CREATE TABLE public.creator_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  report_data JSONB,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent_at TIMESTAMPTZ
);

-- Add new columns to creator_profiles
ALTER TABLE public.creator_profiles 
ADD COLUMN IF NOT EXISTS follower_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tips_received NUMERIC NOT NULL DEFAULT 0;

-- Enable RLS on all new tables
ALTER TABLE public.creator_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_imported_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for creator_followers
CREATE POLICY "Anyone can view follower counts" ON public.creator_followers
FOR SELECT USING (true);

CREATE POLICY "Users can follow creators" ON public.creator_followers
FOR INSERT WITH CHECK (auth.uid() = follower_user_id);

CREATE POLICY "Users can unfollow creators" ON public.creator_followers
FOR DELETE USING (auth.uid() = follower_user_id);

-- RLS Policies for creator_tips
CREATE POLICY "Creators can view their tips" ON public.creator_tips
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_tips.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Users can view their own tips" ON public.creator_tips
FOR SELECT USING (auth.uid() = tipper_user_id);

CREATE POLICY "Service can insert tips" ON public.creator_tips
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update tips" ON public.creator_tips
FOR UPDATE USING (true);

CREATE POLICY "Admins can view all tips" ON public.creator_tips
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for creator_social_accounts
CREATE POLICY "Creators can view their social accounts" ON public.creator_social_accounts
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_social_accounts.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Creators can manage their social accounts" ON public.creator_social_accounts
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_social_accounts.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Creators can update their social accounts" ON public.creator_social_accounts
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_social_accounts.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Creators can delete their social accounts" ON public.creator_social_accounts
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_social_accounts.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Admins can view all social accounts" ON public.creator_social_accounts
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for creator_imported_content
CREATE POLICY "Creators can view their imported content" ON public.creator_imported_content
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_imported_content.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Creators can manage their imported content" ON public.creator_imported_content
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_imported_content.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Admins can view all imported content" ON public.creator_imported_content
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for creator_analytics
CREATE POLICY "Creators can view their analytics" ON public.creator_analytics
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_analytics.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Service can insert analytics" ON public.creator_analytics
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update analytics" ON public.creator_analytics
FOR UPDATE USING (true);

CREATE POLICY "Admins can view all analytics" ON public.creator_analytics
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for creator_reports
CREATE POLICY "Creators can view their reports" ON public.creator_reports
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_reports.creator_id AND cp.user_id = auth.uid())
);

CREATE POLICY "Service can manage reports" ON public.creator_reports
FOR ALL USING (true);

CREATE POLICY "Admins can view all reports" ON public.creator_reports
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Function to update follower count
CREATE OR REPLACE FUNCTION public.update_creator_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.creator_profiles 
    SET follower_count = follower_count + 1 
    WHERE id = NEW.creator_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.creator_profiles 
    SET follower_count = GREATEST(0, follower_count - 1) 
    WHERE id = OLD.creator_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger for follower count updates
CREATE TRIGGER on_follower_change
AFTER INSERT OR DELETE ON public.creator_followers
FOR EACH ROW EXECUTE FUNCTION public.update_creator_follower_count();

-- Function to update tips received
CREATE OR REPLACE FUNCTION public.update_creator_tips_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    UPDATE public.creator_profiles 
    SET total_tips_received = total_tips_received + NEW.amount,
        pending_balance = pending_balance + NEW.amount,
        total_earnings = total_earnings + NEW.amount
    WHERE id = NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for tips updates
CREATE TRIGGER on_tip_completed
AFTER INSERT OR UPDATE ON public.creator_tips
FOR EACH ROW EXECUTE FUNCTION public.update_creator_tips_total();