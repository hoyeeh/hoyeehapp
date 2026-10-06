ALTER TABLE public.home_sections
ADD COLUMN homepage_surface text NOT NULL DEFAULT 'main';

ALTER TABLE public.home_sections
ADD CONSTRAINT home_sections_homepage_surface_check
CHECK (homepage_surface IN ('main', 'kids'));

CREATE INDEX home_sections_surface_active_order_idx
ON public.home_sections (homepage_surface, is_active, display_order);

COMMENT ON COLUMN public.home_sections.homepage_surface IS 'Separates independently managed main and Kids homepage layouts.';