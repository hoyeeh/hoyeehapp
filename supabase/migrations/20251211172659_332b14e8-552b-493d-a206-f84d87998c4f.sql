-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create walkthrough-images storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('walkthrough-images', 'walkthrough-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for avatars bucket
-- Public read access
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Users can upload their own avatar (user_id folder)
CREATE POLICY "Users can upload their own avatar" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own avatar
CREATE POLICY "Users can update their own avatar" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS policies for walkthrough-images bucket
-- Public read access
CREATE POLICY "Walkthrough images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'walkthrough-images');

-- Admin-only upload for walkthrough images
CREATE POLICY "Admins can upload walkthrough images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'walkthrough-images' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Admin-only update for walkthrough images
CREATE POLICY "Admins can update walkthrough images" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'walkthrough-images' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Admin-only delete for walkthrough images
CREATE POLICY "Admins can delete walkthrough images" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'walkthrough-images' 
  AND public.has_role(auth.uid(), 'admin')
);