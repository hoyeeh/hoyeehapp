-- Add intro skip times and recap fields to episodes table
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS intro_start_time integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS intro_end_time integer DEFAULT 90,
ADD COLUMN IF NOT EXISTS recap_start_time integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recap_end_time integer DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN public.episodes.intro_start_time IS 'Start time of the intro in seconds (for Skip Intro button)';
COMMENT ON COLUMN public.episodes.intro_end_time IS 'End time of the intro in seconds (for Skip Intro button)';
COMMENT ON COLUMN public.episodes.recap_start_time IS 'Start time of the "Previously On" recap segment in seconds (NULL if no recap)';
COMMENT ON COLUMN public.episodes.recap_end_time IS 'End time of the "Previously On" recap segment in seconds (NULL if no recap)';