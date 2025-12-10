-- Add retry tracking columns to transcoding_jobs
ALTER TABLE public.transcoding_jobs
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_retry_at timestamp with time zone;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_transcoding_jobs_status ON public.transcoding_jobs(status);
CREATE INDEX IF NOT EXISTS idx_transcoding_jobs_created_at ON public.transcoding_jobs(created_at DESC);