CREATE TABLE public.tv_telemetry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  session_id TEXT,
  pairing_code TEXT,
  user_agent TEXT,
  url TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.tv_telemetry TO authenticated;
GRANT INSERT ON public.tv_telemetry TO anon;
GRANT ALL ON public.tv_telemetry TO service_role;

ALTER TABLE public.tv_telemetry ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauth Smart TVs) may insert their own telemetry rows.
CREATE POLICY "Anyone can insert tv telemetry"
  ON public.tv_telemetry FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins (via has_role) can read telemetry.
CREATE POLICY "Admins can read tv telemetry"
  ON public.tv_telemetry FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_tv_telemetry_created_at ON public.tv_telemetry (created_at DESC);
CREATE INDEX idx_tv_telemetry_event ON public.tv_telemetry (event);
CREATE INDEX idx_tv_telemetry_session ON public.tv_telemetry (session_id);