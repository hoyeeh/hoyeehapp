-- Create youtube_watchlist table for "Watch Later" feature
CREATE TABLE public.youtube_watchlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER,
  channel_name TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique video per user
  UNIQUE(user_id, video_id)
);

-- Enable RLS
ALTER TABLE public.youtube_watchlist ENABLE ROW LEVEL SECURITY;

-- Users can view their own watchlist
CREATE POLICY "Users can view their own youtube watchlist"
  ON public.youtube_watchlist
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add to their own watchlist
CREATE POLICY "Users can add to their own youtube watchlist"
  ON public.youtube_watchlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own watchlist
CREATE POLICY "Users can remove from their own youtube watchlist"
  ON public.youtube_watchlist
  FOR DELETE
  USING (auth.uid() = user_id);