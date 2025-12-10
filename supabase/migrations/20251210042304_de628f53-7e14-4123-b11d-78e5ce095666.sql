-- Create genres table for admin-managed genres
CREATE TABLE public.genres (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;

-- Genre policies
CREATE POLICY "Anyone can view genres" ON public.genres FOR SELECT USING (true);
CREATE POLICY "Admins can insert genres" ON public.genres FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update genres" ON public.genres FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete genres" ON public.genres FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create top_10 table for admin-managed rankings
CREATE TABLE public.top_10 (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  rank integer NOT NULL CHECK (rank >= 1 AND rank <= 10),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (rank),
  UNIQUE (content_id)
);

-- Enable RLS
ALTER TABLE public.top_10 ENABLE ROW LEVEL SECURITY;

-- Top 10 policies
CREATE POLICY "Anyone can view top 10" ON public.top_10 FOR SELECT USING (true);
CREATE POLICY "Admins can insert top 10" ON public.top_10 FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update top 10" ON public.top_10 FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete top 10" ON public.top_10 FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes
CREATE INDEX idx_top_10_rank ON public.top_10(rank);
CREATE INDEX idx_genres_slug ON public.genres(slug);

-- Insert default genres
INSERT INTO public.genres (name, slug) VALUES 
  ('Action', 'action'),
  ('Comedy', 'comedy'),
  ('Drama', 'drama'),
  ('Horror', 'horror'),
  ('Romance', 'romance'),
  ('Sci-Fi', 'sci-fi'),
  ('Thriller', 'thriller'),
  ('Documentary', 'documentary'),
  ('Animation', 'animation'),
  ('Adventure', 'adventure'),
  ('Crime', 'crime'),
  ('Fantasy', 'fantasy'),
  ('Mystery', 'mystery'),
  ('Family', 'family');

-- Add trigger for updating timestamps
CREATE TRIGGER update_genres_updated_at
  BEFORE UPDATE ON public.genres
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_top_10_updated_at
  BEFORE UPDATE ON public.top_10
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();