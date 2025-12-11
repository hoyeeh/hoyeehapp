-- Add cast and director columns to content table
ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS director TEXT,
ADD COLUMN IF NOT EXISTS cast_members JSONB DEFAULT '[]'::jsonb;

-- Add index for faster queries on cast_members
CREATE INDEX IF NOT EXISTS idx_content_cast_members ON public.content USING GIN (cast_members);

-- Add comment for documentation
COMMENT ON COLUMN public.content.cast_members IS 'JSON array of cast members with id, name, character, and profile_path';
COMMENT ON COLUMN public.content.director IS 'Director name from TMDB';