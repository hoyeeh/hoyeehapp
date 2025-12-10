-- Create home_sections table for admin-managed home page sections
CREATE TABLE public.home_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  section_type text NOT NULL DEFAULT 'genre', -- 'genre', 'top10', 'recently_added', 'trending', 'my_list', 'continue_watching', 'custom'
  genre_id uuid REFERENCES public.genres(id) ON DELETE SET NULL,
  card_style text NOT NULL DEFAULT 'poster', -- 'poster', 'backdrop', 'wide', 'square', 'minimal'
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  max_items integer DEFAULT 15,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.home_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view home sections" ON public.home_sections FOR SELECT USING (true);
CREATE POLICY "Admins can insert home sections" ON public.home_sections FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update home sections" ON public.home_sections FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete home sections" ON public.home_sections FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for ordering
CREATE INDEX idx_home_sections_order ON public.home_sections(display_order);

-- Trigger for timestamps
CREATE TRIGGER update_home_sections_updated_at
  BEFORE UPDATE ON public.home_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default sections
INSERT INTO public.home_sections (title, section_type, card_style, display_order) VALUES
  ('Top 10 in Hoyeeh Today', 'top10', 'poster', 1),
  ('Recently Added', 'recently_added', 'poster', 2),
  ('Trending Now', 'trending', 'backdrop', 3),
  ('Popular Movies', 'custom', 'poster', 4),
  ('TV Shows', 'custom', 'wide', 5);