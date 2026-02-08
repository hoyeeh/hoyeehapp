-- Add default sections for newly supported personalized section types
-- These sections will be inserted with default settings, admins can customize later

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, max_items)
SELECT 'Continue Watching', 'continue_watching', 'backdrop', 1, true, true, true, 10
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'continue_watching');

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, max_items)
SELECT 'Recently Watched', 'recently_watched', 'poster', 2, true, true, true, 15
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'recently_watched');

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, max_items)
SELECT 'Because You Watched', 'because_you_watched', 'poster', 7, true, true, true, 15
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'because_you_watched');

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, max_items)
SELECT 'AI Hoyeeh Picks', 'ai_recommendations', 'poster', 8, true, true, true, 15
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'ai_recommendations');

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, max_items)
SELECT 'Coming Soon', 'coming_soon', 'backdrop', 9, true, true, true, 10
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'coming_soon');

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, max_items)
SELECT 'Recommended For You', 'recommendations', 'poster', 5, true, true, false, 15
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'recommendations');

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, show_on_kids, max_items)
SELECT 'Hoyeeh Playables', 'playables', 'square', 10, true, true, true, false, 10
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'playables');

INSERT INTO public.home_sections (title, section_type, card_style, display_order, is_active, show_on_desktop, show_on_mobile, max_items)
SELECT 'My Purchases', 'purchases', 'poster', 3, true, false, true, 10
WHERE NOT EXISTS (SELECT 1 FROM public.home_sections WHERE section_type = 'purchases');