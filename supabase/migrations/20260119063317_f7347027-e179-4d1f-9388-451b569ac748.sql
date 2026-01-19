-- Add source tracking columns to playable_games
ALTER TABLE playable_games ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE playable_games ADD COLUMN IF NOT EXISTS source_id TEXT;