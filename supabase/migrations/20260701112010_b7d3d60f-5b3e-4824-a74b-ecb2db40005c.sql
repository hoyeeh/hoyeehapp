-- Revoke anon direct table access on content/episodes so video_url can't leak.
REVOKE SELECT ON public.content FROM anon;
REVOKE SELECT ON public.episodes FROM anon;

GRANT SELECT ON public.content TO authenticated;
GRANT SELECT ON public.episodes TO authenticated;
GRANT ALL ON public.content TO service_role;
GRANT ALL ON public.episodes TO service_role;

-- Anon-safe browsing views (exclude video_url).
CREATE OR REPLACE VIEW public.content_public
WITH (security_invoker = on) AS
SELECT
  id, title, description, thumbnail_url, genre, content_type,
  is_premium, duration, year, rating, tmdb_id,
  created_at, updated_at, view_count, created_by,
  content_rating, director, cast_members, age_limit,
  lifecycle_status, expires_at, lifecycle_updated_at,
  lifecycle_reason, admin_override, views_last_30_days
FROM public.content;

CREATE OR REPLACE VIEW public.episodes_public
WITH (security_invoker = on) AS
SELECT
  id, season_id, episode_number, title, description, thumbnail_url,
  duration, is_premium, created_at, updated_at,
  intro_start_time, intro_end_time, recap_start_time, recap_end_time
FROM public.episodes;

GRANT SELECT ON public.content_public TO anon, authenticated;
GRANT SELECT ON public.episodes_public TO anon, authenticated;

-- Restrict SELECT policy to authenticated role only (was PUBLIC).
DROP POLICY IF EXISTS "Anyone can view content" ON public.content;
CREATE POLICY "Authenticated users can view content"
  ON public.content FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can view episodes" ON public.episodes;
CREATE POLICY "Authenticated users can view episodes"
  ON public.episodes FOR SELECT
  TO authenticated
  USING (true);