-- Enable realtime for home_sections table to allow automatic updates when admin makes changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_sections;

-- Enable realtime for section_content table (curated content updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.section_content;

-- Enable realtime for top_10 table
ALTER PUBLICATION supabase_realtime ADD TABLE public.top_10;

-- Enable realtime for hero_banners table
ALTER PUBLICATION supabase_realtime ADD TABLE public.hero_banners;