-- Add display target columns to home_sections table
ALTER TABLE public.home_sections 
ADD COLUMN IF NOT EXISTS show_on_desktop BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_on_mobile BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS show_on_kids BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.home_sections.show_on_desktop IS 'Whether to display this section on desktop home page';
COMMENT ON COLUMN public.home_sections.show_on_mobile IS 'Whether to display this section on mobile home page';
COMMENT ON COLUMN public.home_sections.show_on_kids IS 'Whether to display this section on kids home page';