-- Add columns for featured content and section banner to home_sections
ALTER TABLE public.home_sections 
ADD COLUMN IF NOT EXISTS featured_content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS section_banner_url TEXT,
ADD COLUMN IF NOT EXISTS first_card_style TEXT DEFAULT 'backdrop';

-- Add comment for documentation
COMMENT ON COLUMN public.home_sections.featured_content_id IS 'Optional: Pin a specific content item as the first/featured card';
COMMENT ON COLUMN public.home_sections.section_banner_url IS 'Optional: Custom banner image URL for the section';
COMMENT ON COLUMN public.home_sections.first_card_style IS 'Controls how the first card displays: backdrop, full, or poster';