-- Restrict direct video_url exposure to anonymous visitors only.
-- Authenticated users keep full access (playback paths rely on it; premium content
-- additionally flows through the generate-signed-url edge function).

REVOKE SELECT (video_url) ON public.content FROM anon;
REVOKE SELECT (video_url) ON public.episodes FROM anon;

-- Re-affirm explicit column grants for all other columns so anonymous browsing
-- (select=*) continues to work for non-video_url columns via PostgREST.
DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='content' AND column_name <> 'video_url'
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.content TO anon', col.column_name);
  END LOOP;

  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='episodes' AND column_name <> 'video_url'
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.episodes TO anon', col.column_name);
  END LOOP;
END $$;
