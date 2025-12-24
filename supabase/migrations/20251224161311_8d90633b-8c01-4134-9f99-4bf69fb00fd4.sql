-- Fix: Drop existing upload policy and recreate with correct restrictions
DROP POLICY IF EXISTS "Creators can upload to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Creators can view their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Creators can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Creators can delete their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Super admins can view all creator uploads" ON storage.objects;

-- Create new policies that restrict access by user_id folder path
CREATE POLICY "Creators can view their own uploads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'creator-uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Creators can upload to their folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'creator-uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Creators can update their own uploads" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'creator-uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Creators can delete their own uploads" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'creator-uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow super admins to view all creator uploads for KYC review
CREATE POLICY "Super admins can view all creator uploads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'creator-uploads' AND 
    is_super_admin(auth.uid())
  );