-- Make the videos bucket private to require signed URLs
UPDATE storage.buckets 
SET public = false 
WHERE id = 'videos';