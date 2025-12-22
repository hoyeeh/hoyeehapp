-- Create sync history log table
CREATE TABLE public.coming_soon_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id UUID REFERENCES public.content(id) ON DELETE SET NULL,
  tmdb_id INTEGER,
  users_notified INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coming_soon_sync_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view sync logs
CREATE POLICY "Admins can view sync logs"
ON public.coming_soon_sync_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert logs (from edge function)
CREATE POLICY "Service can insert sync logs"
ON public.coming_soon_sync_log
FOR INSERT
WITH CHECK (true);

-- Super admins can delete old logs
CREATE POLICY "Super admins can delete sync logs"
ON public.coming_soon_sync_log
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Add index for faster queries
CREATE INDEX idx_coming_soon_sync_log_synced_at ON public.coming_soon_sync_log(synced_at DESC);