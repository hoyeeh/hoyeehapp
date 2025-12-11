-- Add time limit fields to user_profiles table for kids profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS daily_time_limit_minutes integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS time_watched_today_minutes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_time_reset date DEFAULT CURRENT_DATE;

-- Create kids viewing history table to track what kids watch
CREATE TABLE IF NOT EXISTS public.kids_viewing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  watched_at timestamp with time zone DEFAULT now(),
  duration_watched_minutes integer DEFAULT 0,
  completed boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE public.kids_viewing_history ENABLE ROW LEVEL SECURITY;

-- RLS policies - parents can view their kids' history
CREATE POLICY "Users can view their kids viewing history"
ON public.kids_viewing_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = kids_viewing_history.profile_id
    AND user_profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert kids viewing history"
ON public.kids_viewing_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = kids_viewing_history.profile_id
    AND user_profiles.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete kids viewing history"
ON public.kids_viewing_history
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = kids_viewing_history.profile_id
    AND user_profiles.user_id = auth.uid()
  )
);

-- Create kids categories table
CREATE TABLE IF NOT EXISTS public.kids_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  emoji text NOT NULL DEFAULT '🎬',
  color text NOT NULL DEFAULT 'from-pink-500 to-rose-500',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kids_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view kids categories
CREATE POLICY "Anyone can view kids categories"
ON public.kids_categories
FOR SELECT
USING (true);

-- Admins can manage kids categories
CREATE POLICY "Admins can insert kids categories"
ON public.kids_categories
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update kids categories"
ON public.kids_categories
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete kids categories"
ON public.kids_categories
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Create content-to-kids-category mapping
CREATE TABLE IF NOT EXISTS public.kids_content_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.kids_categories(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(content_id, category_id)
);

-- Enable RLS
ALTER TABLE public.kids_content_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view mappings
CREATE POLICY "Anyone can view kids content categories"
ON public.kids_content_categories
FOR SELECT
USING (true);

-- Admins can manage mappings
CREATE POLICY "Admins can insert kids content categories"
ON public.kids_content_categories
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete kids content categories"
ON public.kids_content_categories
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Insert default kids categories
INSERT INTO public.kids_categories (name, slug, emoji, color, display_order) VALUES
('Learn with Fun', 'learn-with-fun', '📚', 'from-green-500 to-emerald-500', 1),
('Bedtime Stories', 'bedtime-stories', '🌙', 'from-indigo-500 to-purple-500', 2),
('Sing Along', 'sing-along', '🎵', 'from-pink-500 to-rose-500', 3),
('Adventures', 'adventures', '🚀', 'from-orange-500 to-amber-500', 4),
('Animals & Nature', 'animals-nature', '🦁', 'from-cyan-500 to-teal-500', 5),
('Superheroes', 'superheroes', '🦸', 'from-red-500 to-rose-500', 6)
ON CONFLICT (slug) DO NOTHING;