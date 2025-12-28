-- Drop the existing check constraint
ALTER TABLE public.content DROP CONSTRAINT IF EXISTS content_content_type_check;

-- Add updated constraint with more content types to support creator submissions
ALTER TABLE public.content ADD CONSTRAINT content_content_type_check 
  CHECK (content_type = ANY (ARRAY['movie'::text, 'series'::text, 'short'::text, 'video'::text]));