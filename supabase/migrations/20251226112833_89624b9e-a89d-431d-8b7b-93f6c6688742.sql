-- Add command tracking columns to cast_sessions for proper command/heartbeat separation
-- This allows receivers to ignore heartbeat updates and only react to actual commands

ALTER TABLE cast_sessions 
ADD COLUMN IF NOT EXISTS command_seq BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS command_type TEXT,
ADD COLUMN IF NOT EXISTS command_payload JSONB,
ADD COLUMN IF NOT EXISTS command_updated_at TIMESTAMPTZ DEFAULT now();

-- Create index for efficient command_seq lookups
CREATE INDEX IF NOT EXISTS idx_cast_sessions_command_seq 
ON cast_sessions(command_seq);

-- Add comment explaining the purpose
COMMENT ON COLUMN cast_sessions.command_seq IS 'Increments only on LOAD/SEEK/PLAY/PAUSE commands, not heartbeats';
COMMENT ON COLUMN cast_sessions.command_type IS 'Type of last command: LOAD, SEEK, PLAY, PAUSE, STOP, etc.';
COMMENT ON COLUMN cast_sessions.command_payload IS 'Payload of last command for receiver to process';
COMMENT ON COLUMN cast_sessions.command_updated_at IS 'Timestamp of last command, not updated by heartbeats';