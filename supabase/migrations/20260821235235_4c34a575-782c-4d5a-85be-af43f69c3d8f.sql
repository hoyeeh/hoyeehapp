ALTER TABLE public.homepage_ai_suggestions
  ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false;

-- Keep only the two strongest pending suggestions
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY priority DESC, created_at DESC) rn
  FROM public.homepage_ai_suggestions
  WHERE status = 'pending'
)
UPDATE public.homepage_ai_suggestions s
SET status = 'expired'
FROM ranked r
WHERE s.id = r.id AND r.rn > 2;

WITH best AS (
  SELECT id FROM public.homepage_ai_suggestions
  WHERE status = 'pending'
  ORDER BY priority DESC, created_at DESC
  LIMIT 1
)
UPDATE public.homepage_ai_suggestions s
SET is_recommended = (s.id IN (SELECT id FROM best))
WHERE s.status = 'pending';

-- Prevent duplicate active homepage row titles
CREATE UNIQUE INDEX IF NOT EXISTS home_sections_unique_active_title
  ON public.home_sections (lower(btrim(title)))
  WHERE is_active;
