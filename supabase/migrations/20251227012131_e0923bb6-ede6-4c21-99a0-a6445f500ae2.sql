-- Add A/B testing and subscription targeting fields to homepage_ads
ALTER TABLE public.homepage_ads 
ADD COLUMN IF NOT EXISTS ab_test_id uuid,
ADD COLUMN IF NOT EXISTS variant text DEFAULT 'A',
ADD COLUMN IF NOT EXISTS subscription_target text DEFAULT 'all' CHECK (subscription_target IN ('all', 'free', 'premium'));

-- Add variant tracking to events table
ALTER TABLE public.homepage_ads_events
ADD COLUMN IF NOT EXISTS variant text,
ADD COLUMN IF NOT EXISTS user_is_subscribed boolean;

-- Create index for A/B test grouping
CREATE INDEX IF NOT EXISTS idx_homepage_ads_ab_test ON public.homepage_ads(ab_test_id) WHERE ab_test_id IS NOT NULL;

-- Create index for analytics time-based queries
CREATE INDEX IF NOT EXISTS idx_homepage_ads_events_created_at ON public.homepage_ads_events(created_at);
CREATE INDEX IF NOT EXISTS idx_homepage_ads_events_ad_variant ON public.homepage_ads_events(ad_id, variant);

-- Add comment for documentation
COMMENT ON COLUMN public.homepage_ads.ab_test_id IS 'Links ads that are variants of the same A/B test';
COMMENT ON COLUMN public.homepage_ads.variant IS 'A/B test variant identifier (A, B, C, etc.)';
COMMENT ON COLUMN public.homepage_ads.subscription_target IS 'Target audience: all, free (non-subscribers), or premium (subscribers)';