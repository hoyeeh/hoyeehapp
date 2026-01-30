-- Add card_size column to home_sections for configurable card sizes per section
ALTER TABLE public.home_sections 
ADD COLUMN IF NOT EXISTS card_size TEXT DEFAULT 'md';

-- Add comment for documentation
COMMENT ON COLUMN public.home_sections.card_size IS 'Controls card size: sm, md, lg';