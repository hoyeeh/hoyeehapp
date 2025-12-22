-- Add visibility columns to youtube_channels table
ALTER TABLE public.youtube_channels 
ADD COLUMN IF NOT EXISTS show_on_mobile boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_on_desktop boolean DEFAULT true;

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_youtube_channels_visibility 
ON public.youtube_channels (show_on_mobile, show_on_desktop, is_active);