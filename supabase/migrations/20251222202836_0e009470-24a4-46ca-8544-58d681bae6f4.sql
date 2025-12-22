-- Add cover_url to youtube_channels for channel banners
ALTER TABLE public.youtube_channels ADD COLUMN IF NOT EXISTS cover_url TEXT;

-- Create youtube_banners table for admin fallback banners
CREATE TABLE IF NOT EXISTS public.youtube_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.youtube_banners ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view active youtube banners"
  ON public.youtube_banners
  FOR SELECT
  USING (is_active = true);

-- Admin can manage banners
CREATE POLICY "Admins can manage youtube banners"
  ON public.youtube_banners
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_youtube_banners_updated_at
  BEFORE UPDATE ON public.youtube_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();