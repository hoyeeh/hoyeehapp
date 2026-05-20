
ALTER TABLE public.home_sections
  ADD COLUMN IF NOT EXISTS year_min integer,
  ADD COLUMN IF NOT EXISTS year_max integer;
