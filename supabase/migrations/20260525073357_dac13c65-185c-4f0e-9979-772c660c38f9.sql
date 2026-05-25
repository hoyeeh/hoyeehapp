-- 1) Restrict raw video_url from authenticated role on content & episodes.
-- Keep table SELECT for all other columns; revoke column-level SELECT on video_url.
REVOKE SELECT (video_url) ON public.content FROM authenticated, anon;
REVOKE SELECT (video_url) ON public.episodes FROM authenticated, anon;

-- 2) Remove overly broad storage policy that exposed every creator-uploads file
-- to any authenticated user. Path-scoped policies + admin policies remain.
DROP POLICY IF EXISTS "Creators can view their uploads" ON storage.objects;