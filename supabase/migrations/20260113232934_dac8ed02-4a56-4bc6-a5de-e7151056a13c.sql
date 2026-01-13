-- Add tracking columns for external subtitle sources
ALTER TABLE subtitles 
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS fetch_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_fetch_attempt TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_metadata JSONB;

-- Create index for faster external source lookups
CREATE INDEX IF NOT EXISTS idx_subtitles_external_source 
  ON subtitles(external_source);

-- Create index for fetch attempts to find content needing subtitles
CREATE INDEX IF NOT EXISTS idx_subtitles_fetch_attempts 
  ON subtitles(content_id, fetch_attempts);