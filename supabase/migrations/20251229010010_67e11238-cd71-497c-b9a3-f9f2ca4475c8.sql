-- Create subtitles storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('subtitles', 'subtitles', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload subtitles
CREATE POLICY "Admins can upload subtitles"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'subtitles' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow anyone to read subtitles (for video players)
CREATE POLICY "Anyone can view subtitles"
ON storage.objects
FOR SELECT
USING (bucket_id = 'subtitles');

-- Allow admins to update subtitles
CREATE POLICY "Admins can update subtitles"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'subtitles' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete subtitles
CREATE POLICY "Admins can delete subtitles"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'subtitles' 
  AND has_role(auth.uid(), 'admin'::app_role)
);