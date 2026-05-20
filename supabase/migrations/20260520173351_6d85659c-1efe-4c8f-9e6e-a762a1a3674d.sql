-- 1. Restrict creator_followers SELECT to authenticated users
DROP POLICY IF EXISTS "Anyone can view follower counts" ON public.creator_followers;

CREATE POLICY "Authenticated users can view follower relationships"
ON public.creator_followers
FOR SELECT
TO authenticated
USING (true);

-- 2. Remove blanket public SELECT on creator-uploads bucket.
-- All consumers use signed URLs (createSignedUrl), which bypass RLS,
-- so removing the public policy does not break image/video display.
DROP POLICY IF EXISTS "Creator images are publicly viewable" ON storage.objects;