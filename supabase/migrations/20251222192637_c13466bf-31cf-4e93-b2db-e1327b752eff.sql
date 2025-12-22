-- Create youtube_channels table for admin-managed YouTube channels
CREATE TABLE public.youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel_id TEXT NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,
  subscriber_count TEXT,
  video_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create youtube_playlists table for channel playlists
CREATE TABLE public.youtube_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  playlist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  video_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, playlist_id)
);

-- Create youtube_videos table for cached video data
CREATE TABLE public.youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES public.youtube_playlists(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  published_at TIMESTAMPTZ,
  view_count BIGINT DEFAULT 0,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(playlist_id, video_id)
);

-- Enable RLS on all tables
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies for youtube_channels
CREATE POLICY "Anyone can view active youtube channels"
ON public.youtube_channels FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can view all youtube channels"
ON public.youtube_channels FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert youtube channels"
ON public.youtube_channels FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update youtube channels"
ON public.youtube_channels FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete youtube channels"
ON public.youtube_channels FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for youtube_playlists
CREATE POLICY "Anyone can view playlists from active channels"
ON public.youtube_playlists FOR SELECT
USING (
  is_active = true AND 
  EXISTS (SELECT 1 FROM public.youtube_channels WHERE id = youtube_playlists.channel_id AND is_active = true)
);

CREATE POLICY "Admins can view all youtube playlists"
ON public.youtube_playlists FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert youtube playlists"
ON public.youtube_playlists FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update youtube playlists"
ON public.youtube_playlists FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete youtube playlists"
ON public.youtube_playlists FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for youtube_videos
CREATE POLICY "Anyone can view videos from active playlists"
ON public.youtube_videos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.youtube_playlists p
    JOIN public.youtube_channels c ON p.channel_id = c.id
    WHERE p.id = youtube_videos.playlist_id AND p.is_active = true AND c.is_active = true
  )
);

CREATE POLICY "Admins can view all youtube videos"
ON public.youtube_videos FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert youtube videos"
ON public.youtube_videos FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update youtube videos"
ON public.youtube_videos FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete youtube videos"
ON public.youtube_videos FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_youtube_channels_updated_at
BEFORE UPDATE ON public.youtube_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_youtube_playlists_updated_at
BEFORE UPDATE ON public.youtube_playlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_youtube_videos_updated_at
BEFORE UPDATE ON public.youtube_videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();