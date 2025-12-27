-- Create homepage_ads table
CREATE TABLE public.homepage_ads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  priority INTEGER NOT NULL DEFAULT 100,
  weight INTEGER NOT NULL DEFAULT 1,
  video_url TEXT,
  video_type TEXT CHECK (video_type IN ('mp4', 'hls')),
  poster_url TEXT NOT NULL,
  cta_label TEXT,
  cta_url TEXT,
  cta_internal_route TEXT,
  contexts JSONB NOT NULL DEFAULT '{"main": true, "kids": false, "tv": false}'::jsonb,
  targeting JSONB,
  kids_safe BOOLEAN NOT NULL DEFAULT false,
  start_at TIMESTAMP WITH TIME ZONE,
  end_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create homepage_ads_events table for analytics
CREATE TABLE public.homepage_ads_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id UUID NOT NULL REFERENCES public.homepage_ads(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_id UUID,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'play', 'pause', 'error', 'mute', 'unmute')),
  device_type TEXT,
  app_context TEXT CHECK (app_context IN ('main', 'kids', 'tv')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_homepage_ads_status ON public.homepage_ads(status);
CREATE INDEX idx_homepage_ads_schedule ON public.homepage_ads(start_at, end_at);
CREATE INDEX idx_homepage_ads_priority ON public.homepage_ads(priority DESC, weight DESC);
CREATE INDEX idx_homepage_ads_events_ad_id ON public.homepage_ads_events(ad_id);
CREATE INDEX idx_homepage_ads_events_created ON public.homepage_ads_events(created_at);

-- Enable RLS
ALTER TABLE public.homepage_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_ads_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for homepage_ads
CREATE POLICY "Anyone can view active ads within schedule"
  ON public.homepage_ads
  FOR SELECT
  USING (
    status = 'active' 
    AND (start_at IS NULL OR start_at <= now()) 
    AND (end_at IS NULL OR end_at > now())
  );

CREATE POLICY "Admins can view all ads"
  ON public.homepage_ads
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert ads"
  ON public.homepage_ads
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update ads"
  ON public.homepage_ads
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete ads"
  ON public.homepage_ads
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for homepage_ads_events
CREATE POLICY "Anyone can insert events"
  ON public.homepage_ads_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all events"
  ON public.homepage_ads_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_homepage_ads_updated_at
  BEFORE UPDATE ON public.homepage_ads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();