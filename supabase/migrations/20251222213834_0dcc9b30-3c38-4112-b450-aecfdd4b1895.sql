-- Add kids-friendly fields to youtube_channels
ALTER TABLE public.youtube_channels 
ADD COLUMN IF NOT EXISTS is_kids_friendly boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS kids_category_id uuid REFERENCES public.kids_categories(id) ON DELETE SET NULL;

-- Create index for faster kids content queries
CREATE INDEX IF NOT EXISTS idx_youtube_channels_kids_friendly ON public.youtube_channels(is_kids_friendly) WHERE is_kids_friendly = true;