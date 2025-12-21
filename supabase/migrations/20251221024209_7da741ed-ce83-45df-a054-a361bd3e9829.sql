-- Remove the public SELECT policy for videos since bucket is now private
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;