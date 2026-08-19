-- 1. Public read of trending metadata so the homepage can explain AI picks
DROP POLICY IF EXISTS "Anyone can view external trends" ON public.external_trends;
CREATE POLICY "Anyone can view external trends"
ON public.external_trends FOR SELECT
TO anon, authenticated
USING (true);
GRANT SELECT ON public.external_trends TO anon, authenticated;

-- 2. Collapse the multiple Top 10 sections down to exactly two: Movies + Series
UPDATE public.home_sections
SET title = 'Top 10 Movies Today', content_type_filter = 'movie', max_items = 10, display_order = 2, is_active = true
WHERE id = 'fc941a40-dbf7-4f29-8b98-7b7815443b97';

UPDATE public.home_sections
SET title = 'Top 10 Series Today', content_type_filter = 'series', max_items = 10, display_order = 3, is_active = true
WHERE id = 'b25f1309-7adc-49a1-b1cf-a25b3f2200f5';

UPDATE public.home_sections
SET is_active = false
WHERE section_type = 'top10'
  AND id NOT IN ('fc941a40-dbf7-4f29-8b98-7b7815443b97','b25f1309-7adc-49a1-b1cf-a25b3f2200f5');

-- 3. Remove repeated sections (same normalised title + type) — keep the earliest one
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY lower(btrim(title)), section_type
           ORDER BY display_order, created_at
         ) AS rn
  FROM public.home_sections
  WHERE is_active = true
)
UPDATE public.home_sections hs
SET is_active = false
FROM ranked r
WHERE hs.id = r.id AND r.rn > 1;