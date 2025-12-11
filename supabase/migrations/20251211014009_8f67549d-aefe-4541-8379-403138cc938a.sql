-- Create download_licenses table to track download rights
CREATE TABLE public.download_licenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_verified TIMESTAMP WITH TIME ZONE DEFAULT now(),
  quality TEXT DEFAULT '720p',
  total_size BIGINT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, content_id, episode_id, device_id)
);

-- Enable RLS
ALTER TABLE public.download_licenses ENABLE ROW LEVEL SECURITY;

-- Users can view their own licenses
CREATE POLICY "Users can view their own download licenses"
ON public.download_licenses
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own licenses
CREATE POLICY "Users can insert their own download licenses"
ON public.download_licenses
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own licenses
CREATE POLICY "Users can update their own download licenses"
ON public.download_licenses
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own licenses
CREATE POLICY "Users can delete their own download licenses"
ON public.download_licenses
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_download_licenses_user_content ON public.download_licenses(user_id, content_id);
CREATE INDEX idx_download_licenses_device ON public.download_licenses(device_id);
CREATE INDEX idx_download_licenses_expires ON public.download_licenses(expires_at);