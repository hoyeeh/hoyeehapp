-- Add is_free column to paid_content table
-- Allows creators to mark content as free while keeping it in the creator store system
ALTER TABLE public.paid_content 
ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.paid_content.is_free IS 'When true, content is free to watch without purchase while still being in the creator store';