-- Add year_filter column to home_sections for filtering by year
ALTER TABLE public.home_sections 
ADD COLUMN year_filter integer;

-- Add comment explaining the column
COMMENT ON COLUMN public.home_sections.year_filter IS 'Year filter for series/movie sections. When set, only content from this year will be shown.';

-- Update trigger if needed
CREATE OR REPLACE FUNCTION public.update_home_sections_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Check if trigger already exists and create if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_home_sections_updated_at_trigger'
  ) THEN
    CREATE TRIGGER update_home_sections_updated_at_trigger
    BEFORE UPDATE ON public.home_sections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_home_sections_updated_at();
  END IF;
END
$$;