-- Activate continue_watching section and enable for kids
UPDATE public.home_sections 
SET is_active = true, show_on_kids = true, show_on_mobile = true, show_on_desktop = true
WHERE section_type = 'continue_watching';

-- If no continue_watching section exists, create one
INSERT INTO public.home_sections (title, section_type, display_order, is_active, show_on_desktop, show_on_mobile, show_on_kids, allow_duplicates)
SELECT 'Continue Watching', 'continue_watching', 1, true, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'continue_watching');