-- Add age_limit column to content table for precise age-based filtering
ALTER TABLE public.content 
ADD COLUMN age_limit integer DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.content.age_limit IS 'Maximum recommended age for viewing. NULL means no age restriction. Used for precise kids content filtering.';

-- Create an index for efficient age-based queries
CREATE INDEX idx_content_age_limit ON public.content(age_limit) WHERE age_limit IS NOT NULL;