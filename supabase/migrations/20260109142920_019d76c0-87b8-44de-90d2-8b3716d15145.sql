-- Add video preview settings to hero_banners
ALTER TABLE public.hero_banners 
ADD COLUMN IF NOT EXISTS video_start_time integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_duration integer DEFAULT NULL;

COMMENT ON COLUMN public.hero_banners.video_start_time IS 'Seconds into video to start preview (default 0)';
COMMENT ON COLUMN public.hero_banners.video_duration IS 'Duration in seconds for preview loop (null = full video)';

-- Add video and scheduling support to profile_backgrounds
ALTER TABLE public.profile_backgrounds 
ADD COLUMN IF NOT EXISTS video_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS video_start_time integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_duration integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS start_date timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS end_date timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.profile_backgrounds.video_url IS 'Optional video URL for background preview';
COMMENT ON COLUMN public.profile_backgrounds.video_start_time IS 'Seconds into video to start preview (default 0)';
COMMENT ON COLUMN public.profile_backgrounds.video_duration IS 'Duration in seconds for preview loop (null = full video)';
COMMENT ON COLUMN public.profile_backgrounds.start_date IS 'Optional start date for scheduled activation';
COMMENT ON COLUMN public.profile_backgrounds.end_date IS 'Optional end date for scheduled deactivation';