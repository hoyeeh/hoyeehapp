-- Add content_type_filter column to home_sections table
ALTER TABLE public.home_sections 
ADD COLUMN IF NOT EXISTS content_type_filter text DEFAULT 'all';