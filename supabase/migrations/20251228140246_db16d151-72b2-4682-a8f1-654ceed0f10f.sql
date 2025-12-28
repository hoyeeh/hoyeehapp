-- Add last_synced_at column to youtube_channels table
ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add last_synced_at column to youtube_playlists table
ALTER TABLE youtube_playlists ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;