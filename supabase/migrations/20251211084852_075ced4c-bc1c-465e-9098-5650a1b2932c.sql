-- Add backdrop_url and tmdb_id columns to coming_soon table
ALTER TABLE public.coming_soon 
ADD COLUMN IF NOT EXISTS backdrop_url text,
ADD COLUMN IF NOT EXISTS tmdb_id integer;