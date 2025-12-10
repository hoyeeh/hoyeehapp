-- Create cast_receivers table for registered TV receivers
CREATE TABLE public.cast_receivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name VARCHAR(100) NOT NULL,
  device_type VARCHAR(50) DEFAULT 'smart_tv',
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for cast_receivers
ALTER TABLE public.cast_receivers ENABLE ROW LEVEL SECURITY;

-- RLS policies for cast_receivers
CREATE POLICY "Users can view their own receivers"
ON public.cast_receivers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own receivers"
ON public.cast_receivers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receivers"
ON public.cast_receivers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receivers"
ON public.cast_receivers FOR DELETE
USING (auth.uid() = user_id);

-- Allow public access for receiver registration (needed for TV pairing)
CREATE POLICY "Public can create receivers for pairing"
ON public.cast_receivers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public can view receivers for pairing"
ON public.cast_receivers FOR SELECT
USING (true);

-- Create cast_sessions table for pairing and active sessions
CREATE TABLE public.cast_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_code VARCHAR(6) UNIQUE NOT NULL,
  receiver_id UUID REFERENCES public.cast_receivers(id) ON DELETE CASCADE,
  controller_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  video_url TEXT,
  video_title TEXT,
  video_thumbnail TEXT,
  playback_time NUMERIC DEFAULT 0,
  video_duration NUMERIC DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  volume_level INTEGER DEFAULT 100,
  queue JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 minutes'),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for cast_sessions
ALTER TABLE public.cast_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for cast_sessions (permissive for pairing flow)
CREATE POLICY "Anyone can view sessions"
ON public.cast_sessions FOR SELECT
USING (true);

CREATE POLICY "Anyone can create sessions"
ON public.cast_sessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update sessions"
ON public.cast_sessions FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete sessions"
ON public.cast_sessions FOR DELETE
USING (true);

-- Create indexes for performance
CREATE INDEX idx_cast_sessions_pairing_code ON public.cast_sessions(pairing_code);
CREATE INDEX idx_cast_sessions_status ON public.cast_sessions(status);
CREATE INDEX idx_cast_receivers_user_id ON public.cast_receivers(user_id);

-- Enable realtime for cast_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.cast_sessions;