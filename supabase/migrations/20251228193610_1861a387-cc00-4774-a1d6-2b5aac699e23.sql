-- Create subtitles table for tracking generated subtitles
CREATE TABLE public.subtitles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  language_code VARCHAR(10) NOT NULL,
  language_label VARCHAR(50) NOT NULL,
  subtitle_url TEXT NOT NULL,
  cdn_url TEXT,
  word_count INTEGER DEFAULT 0,
  duration_seconds NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure unique subtitle per content/episode/language combination
  CONSTRAINT unique_subtitle_per_content_language UNIQUE (content_id, episode_id, language_code)
);

-- Create index for faster lookups
CREATE INDEX idx_subtitles_content_id ON public.subtitles(content_id);
CREATE INDEX idx_subtitles_episode_id ON public.subtitles(episode_id);
CREATE INDEX idx_subtitles_language_code ON public.subtitles(language_code);

-- Enable RLS
ALTER TABLE public.subtitles ENABLE ROW LEVEL SECURITY;

-- Public can read subtitles (needed for video playback)
CREATE POLICY "Anyone can read subtitles"
  ON public.subtitles
  FOR SELECT
  USING (true);

-- Only admins can insert/update/delete subtitles
CREATE POLICY "Admins can manage subtitles"
  ON public.subtitles
  FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_subtitles_updated_at
  BEFORE UPDATE ON public.subtitles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for subtitles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.subtitles;