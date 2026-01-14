-- Create subtitle generation logs table
CREATE TABLE public.subtitle_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  video_url TEXT,
  video_duration_seconds NUMERIC,
  transcription_model TEXT DEFAULT 'whisper-1',
  languages_generated TEXT[] DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_subtitle_generation_logs_content ON public.subtitle_generation_logs(content_id);
CREATE INDEX idx_subtitle_generation_logs_episode ON public.subtitle_generation_logs(episode_id);
CREATE INDEX idx_subtitle_generation_logs_status ON public.subtitle_generation_logs(status);

-- Enable RLS
ALTER TABLE public.subtitle_generation_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read all logs using existing has_role RPC
CREATE POLICY "Admins can view subtitle generation logs"
ON public.subtitle_generation_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow all operations for service role (edge functions)
CREATE POLICY "Service role full access to subtitle generation logs"
ON public.subtitle_generation_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_subtitle_generation_logs_updated_at
BEFORE UPDATE ON public.subtitle_generation_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();