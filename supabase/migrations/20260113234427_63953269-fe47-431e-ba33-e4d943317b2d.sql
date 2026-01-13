-- Create subtitle sync jobs table for tracking batch sync progress
CREATE TABLE public.subtitle_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'paused')),
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  successful_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  skipped_items INTEGER DEFAULT 0,
  content_types TEXT[] DEFAULT ARRAY['movie', 'series'],
  languages TEXT[] DEFAULT ARRAY['en', 'fr'],
  current_content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
  current_episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  error_log JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.subtitle_sync_jobs ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can view sync jobs"
ON public.subtitle_sync_jobs FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can create sync jobs"
ON public.subtitle_sync_jobs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins can update sync jobs"
ON public.subtitle_sync_jobs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

-- Index for querying active jobs
CREATE INDEX idx_subtitle_sync_jobs_status ON public.subtitle_sync_jobs(status);
CREATE INDEX idx_subtitle_sync_jobs_created_at ON public.subtitle_sync_jobs(created_at DESC);