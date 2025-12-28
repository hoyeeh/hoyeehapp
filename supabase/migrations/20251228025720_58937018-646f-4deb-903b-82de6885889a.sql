-- Create storage policies for creator-uploads bucket
-- Allow creators to upload files to their own folder (avatar/creatorId/* or cover/creatorId/*)

-- Policy: Creators can upload to their own folder
CREATE POLICY "Creators can upload their own images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'creator-uploads'
  AND (
    -- Check if the user is the owner of this creator profile
    EXISTS (
      SELECT 1 FROM public.creator_profiles
      WHERE id::text = (storage.foldername(name))[2]
      AND user_id = auth.uid()
    )
  )
);

-- Policy: Creators can update their own files
CREATE POLICY "Creators can update their own images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'creator-uploads'
  AND EXISTS (
    SELECT 1 FROM public.creator_profiles
    WHERE id::text = (storage.foldername(name))[2]
    AND user_id = auth.uid()
  )
);

-- Policy: Creators can delete their own files
CREATE POLICY "Creators can delete their own images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'creator-uploads'
  AND EXISTS (
    SELECT 1 FROM public.creator_profiles
    WHERE id::text = (storage.foldername(name))[2]
    AND user_id = auth.uid()
  )
);

-- Policy: Allow public read access for creator images (so profile images are viewable)
CREATE POLICY "Creator images are publicly viewable"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'creator-uploads');