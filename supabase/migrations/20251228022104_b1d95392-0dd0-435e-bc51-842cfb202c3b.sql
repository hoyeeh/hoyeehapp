-- Create featured_creators table for admin-managed carousel
CREATE TABLE public.featured_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.creator_profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  banner_image_url TEXT NOT NULL,
  cta_label TEXT DEFAULT 'View Content',
  priority INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX idx_featured_creators_status ON public.featured_creators(status);
CREATE INDEX idx_featured_creators_priority ON public.featured_creators(priority DESC);

-- Enable RLS
ALTER TABLE public.featured_creators ENABLE ROW LEVEL SECURITY;

-- Public can read active featured creators
CREATE POLICY "Anyone can view active featured creators"
ON public.featured_creators
FOR SELECT
USING (
  status = 'active' 
  AND (start_at IS NULL OR start_at <= NOW()) 
  AND (end_at IS NULL OR end_at > NOW())
);

-- Only admins can manage featured creators
CREATE POLICY "Admins can manage featured creators"
ON public.featured_creators
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_featured_creators_updated_at
BEFORE UPDATE ON public.featured_creators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();