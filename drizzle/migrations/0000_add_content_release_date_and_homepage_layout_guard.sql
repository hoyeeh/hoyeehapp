ALTER TABLE public.content ADD COLUMN IF NOT EXISTS release_date date;

COMMENT ON COLUMN public.content.release_date IS 'Exact movie release or series first-air date used for homepage ordering; falls back to year and created_at when null.';

CREATE OR REPLACE FUNCTION public.enforce_homepage_layout_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  live_mode text;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT mode INTO live_mode
  FROM public.homepage_layout_state
  ORDER BY created_at
  LIMIT 1;

  live_mode := COALESCE(live_mode, 'manual');
  IF COALESCE(NEW.source, 'manual') <> live_mode THEN
    RAISE EXCEPTION 'Active homepage sections must belong to the live % layout', live_mode;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_homepage_layout_source_trigger ON public.home_sections;
CREATE TRIGGER enforce_homepage_layout_source_trigger
BEFORE INSERT OR UPDATE OF is_active, source ON public.home_sections
FOR EACH ROW
EXECUTE FUNCTION public.enforce_homepage_layout_source();