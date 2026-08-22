ALTER TABLE public.home_sections
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cloned_from uuid;

ALTER TABLE public.home_sections
  DROP CONSTRAINT IF EXISTS home_sections_source_check;
ALTER TABLE public.home_sections
  ADD CONSTRAINT home_sections_source_check CHECK (source IN ('manual','ai'));

CREATE TABLE IF NOT EXISTS public.homepage_layout_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'manual',
  manual_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  switched_by uuid,
  switched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homepage_layout_state_mode_check CHECK (mode IN ('manual','ai'))
);

GRANT SELECT ON public.homepage_layout_state TO authenticated;
GRANT ALL ON public.homepage_layout_state TO service_role;

ALTER TABLE public.homepage_layout_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view homepage layout state" ON public.homepage_layout_state;
CREATE POLICY "Admins can view homepage layout state"
ON public.homepage_layout_state FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS update_homepage_layout_state_updated_at ON public.homepage_layout_state;
CREATE TRIGGER update_homepage_layout_state_updated_at
BEFORE UPDATE ON public.homepage_layout_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.homepage_layout_state (mode)
SELECT 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.homepage_layout_state);