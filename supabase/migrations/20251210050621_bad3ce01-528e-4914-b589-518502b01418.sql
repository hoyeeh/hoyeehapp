-- Create ratings and reviews table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for reviews
CREATE POLICY "Anyone can view reviews"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Create coming soon table
CREATE TABLE public.coming_soon (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  trailer_url TEXT,
  content_type TEXT NOT NULL DEFAULT 'movie',
  genre TEXT,
  expected_release_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on coming_soon
ALTER TABLE public.coming_soon ENABLE ROW LEVEL SECURITY;

-- RLS policies for coming_soon
CREATE POLICY "Anyone can view coming soon"
  ON public.coming_soon FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert coming soon"
  ON public.coming_soon FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update coming soon"
  ON public.coming_soon FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete coming soon"
  ON public.coming_soon FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Coming soon watchlist (notify when available)
CREATE TABLE public.coming_soon_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coming_soon_id UUID NOT NULL REFERENCES public.coming_soon(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, coming_soon_id)
);

-- Enable RLS
ALTER TABLE public.coming_soon_watchlist ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their coming soon watchlist"
  ON public.coming_soon_watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add to coming soon watchlist"
  ON public.coming_soon_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from coming soon watchlist"
  ON public.coming_soon_watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- Hero banner management table
CREATE TABLE public.hero_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  image_url TEXT,
  video_url TEXT,
  cta_text TEXT DEFAULT 'Watch Now',
  cta_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on hero_banners
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

-- RLS policies for hero_banners
CREATE POLICY "Anyone can view hero banners"
  ON public.hero_banners FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert hero banners"
  ON public.hero_banners FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update hero banners"
  ON public.hero_banners FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete hero banners"
  ON public.hero_banners FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_reviews_content_id ON public.reviews(content_id);
CREATE INDEX idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX idx_coming_soon_release_date ON public.coming_soon(expected_release_date);
CREATE INDEX idx_hero_banners_order ON public.hero_banners(display_order);

-- Add triggers for updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coming_soon_updated_at
  BEFORE UPDATE ON public.coming_soon
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hero_banners_updated_at
  BEFORE UPDATE ON public.hero_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();