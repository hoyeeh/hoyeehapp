-- Create free content analytics table
CREATE TABLE public.free_content_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.home_sections(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'play', 'complete')),
  session_id TEXT,
  device_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_free_content_analytics_content ON public.free_content_analytics(content_id);
CREATE INDEX idx_free_content_analytics_user ON public.free_content_analytics(user_id);
CREATE INDEX idx_free_content_analytics_section ON public.free_content_analytics(section_id);
CREATE INDEX idx_free_content_analytics_created ON public.free_content_analytics(created_at);
CREATE INDEX idx_free_content_analytics_event_type ON public.free_content_analytics(event_type);

-- Enable RLS
ALTER TABLE public.free_content_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own analytics
CREATE POLICY "Users can insert own analytics"
ON public.free_content_analytics
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Admins can read all analytics
CREATE POLICY "Admins can read all analytics"
ON public.free_content_analytics
FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

-- Create premium conversion tracking table
CREATE TABLE public.premium_conversion_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  free_content_viewed JSONB DEFAULT '[]'::jsonb,
  free_content_count INTEGER DEFAULT 0,
  first_free_content_at TIMESTAMP WITH TIME ZONE,
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_plan TEXT,
  days_to_convert INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create index
CREATE INDEX idx_premium_conversion_user ON public.premium_conversion_tracking(user_id);
CREATE INDEX idx_premium_conversion_subscribed ON public.premium_conversion_tracking(subscription_started_at);

-- Enable RLS
ALTER TABLE public.premium_conversion_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view/update own tracking
CREATE POLICY "Users can manage own conversion tracking"
ON public.premium_conversion_tracking
FOR ALL
USING (auth.uid() = user_id);

-- Policy: Admins can read all tracking
CREATE POLICY "Admins can read all conversion tracking"
ON public.premium_conversion_tracking
FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_premium_conversion_tracking_updated_at
BEFORE UPDATE ON public.premium_conversion_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_curated column to home_sections for free_content sections
ALTER TABLE public.home_sections 
ADD COLUMN IF NOT EXISTS is_curated BOOLEAN NOT NULL DEFAULT false;