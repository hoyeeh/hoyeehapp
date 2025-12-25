-- Add allow_duplicates column to home_sections table
ALTER TABLE public.home_sections 
ADD COLUMN allow_duplicates boolean NOT NULL DEFAULT false;

-- Set default values based on section_type (curated, top10, trending allow duplicates by default)
UPDATE public.home_sections 
SET allow_duplicates = true 
WHERE section_type IN ('curated', 'top10', 'trending');

-- Insert platform setting for global deduplication toggle
INSERT INTO public.platform_settings (setting_key, setting_value, description)
VALUES ('home_enable_deduplication', 'true', 'Enable content deduplication across home page sections')
ON CONFLICT (setting_key) DO NOTHING;