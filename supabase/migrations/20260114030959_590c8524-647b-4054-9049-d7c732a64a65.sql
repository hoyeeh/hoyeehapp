-- Create storage bucket for playable game covers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'playable-covers', 
  'playable-covers', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
);

-- Allow public read access to game covers
CREATE POLICY "Public can view game covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'playable-covers');

-- Allow admins to upload game covers
CREATE POLICY "Admins can upload game covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'playable-covers' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update game covers
CREATE POLICY "Admins can update game covers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'playable-covers' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete game covers
CREATE POLICY "Admins can delete game covers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'playable-covers' 
  AND public.has_role(auth.uid(), 'admin')
);