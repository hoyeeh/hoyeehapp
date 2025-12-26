-- Add cast_events audit table for debugging and analytics
CREATE TABLE IF NOT EXISTS cast_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES cast_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  actor TEXT NOT NULL CHECK (actor IN ('receiver', 'controller', 'system')),
  event_type TEXT NOT NULL CHECK (event_type IN ('PAIR', 'COMMAND', 'HEARTBEAT', 'ERROR', 'DISCONNECT', 'GENERATE_CODE')),
  payload JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on cast_events
ALTER TABLE cast_events ENABLE ROW LEVEL SECURITY;

-- Policies for cast_events - allow service role full access, read-only for debugging
CREATE POLICY "Service role can manage cast_events" 
ON cast_events 
FOR ALL 
USING (true);

CREATE POLICY "Users can view their session events" 
ON cast_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM cast_sessions 
    WHERE cast_sessions.id = cast_events.session_id 
    AND cast_sessions.controller_user_id = auth.uid()
  )
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cast_events_session ON cast_events(session_id);
CREATE INDEX IF NOT EXISTS idx_cast_events_created ON cast_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cast_events_type ON cast_events(event_type);

-- Add receiver-specific heartbeat columns to cast_sessions
ALTER TABLE cast_sessions 
ADD COLUMN IF NOT EXISTS receiver_playback_time NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS receiver_is_playing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS controller_last_heartbeat TIMESTAMPTZ;

-- Enable realtime for cast_events
ALTER PUBLICATION supabase_realtime ADD TABLE cast_events;