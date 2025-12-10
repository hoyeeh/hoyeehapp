-- Create section_content table for mapping specific content to sections
CREATE TABLE public.section_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES public.home_sections(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(section_id, content_id)
);

-- Enable RLS
ALTER TABLE public.section_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view section content" ON public.section_content FOR SELECT USING (true);
CREATE POLICY "Admins can insert section content" ON public.section_content FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update section content" ON public.section_content FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete section content" ON public.section_content FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add content_rating column to content table for parental controls
ALTER TABLE public.content ADD COLUMN IF NOT EXISTS content_rating TEXT DEFAULT 'PG';

-- Add parental control columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parental_pin TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parental_rating_limit TEXT DEFAULT 'R';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parental_controls_enabled BOOLEAN DEFAULT false;

-- Add curated section type
-- Update home_sections to support curated content
COMMENT ON TABLE public.section_content IS 'Maps specific content items to home page sections for curated lists';