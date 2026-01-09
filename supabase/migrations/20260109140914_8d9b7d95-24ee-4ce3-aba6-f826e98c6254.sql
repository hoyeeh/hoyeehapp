-- Create table for admin-managed profile backgrounds
CREATE TABLE public.profile_backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  tmdb_id INTEGER,
  content_type TEXT DEFAULT 'movie',
  desktop_image_url TEXT,
  mobile_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_backgrounds ENABLE ROW LEVEL SECURITY;

-- Public read policy for active backgrounds
CREATE POLICY "Anyone can view active profile backgrounds" ON public.profile_backgrounds
  FOR SELECT USING (is_active = true);

-- Admin full access policy
CREATE POLICY "Admins can manage profile backgrounds" ON public.profile_backgrounds
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())
  );

-- Create trigger for updated_at
CREATE TRIGGER update_profile_backgrounds_updated_at
  BEFORE UPDATE ON public.profile_backgrounds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();