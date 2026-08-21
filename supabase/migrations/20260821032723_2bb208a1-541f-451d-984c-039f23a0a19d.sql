-- Keep only the two curated Top 10 rows active
UPDATE public.home_sections
SET is_active = false
WHERE section_type = 'top10'
  AND is_active = true
  AND id NOT IN ('fc941a40-dbf7-4f29-8b98-7b7815443b97','b25f1309-7adc-49a1-b1cf-a25b3f2200f5');

-- Collapse near-duplicate rows that repeat the same topic
-- (e.g. "Trending Worldwide: Drama" vs "Trending Dramas Worldwide")
WITH topic AS (
  SELECT
    id,
    display_order,
    created_at,
    (
      SELECT string_agg(w, ' ' ORDER BY w)
      FROM (
        SELECT DISTINCT regexp_replace(w, 's$', '') AS w
        FROM unnest(
          string_to_array(
            btrim(regexp_replace(lower(title), '[^a-z ]', ' ', 'g')),
            ' '
          )
        ) AS w
        WHERE w <> ''
          AND w NOT IN ('trending','worldwide','now','today','the','and','a','top','right','popular')
      ) t
    ) AS topic_key
  FROM public.home_sections
  WHERE is_active = true
    AND section_type IN ('trending','genre','recently_added','curated','series')
),
ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY topic_key ORDER BY display_order, created_at
  ) AS rn
  FROM topic
  WHERE topic_key IS NOT NULL AND topic_key <> ''
)
UPDATE public.home_sections hs
SET is_active = false
FROM ranked r
WHERE hs.id = r.id AND r.rn > 1;