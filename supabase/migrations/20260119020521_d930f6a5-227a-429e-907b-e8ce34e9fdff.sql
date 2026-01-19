-- Add featured column for curated games
ALTER TABLE playable_games ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

-- Reset Moto X3M to allow re-testing
UPDATE playable_games 
SET health_status = 'unknown' 
WHERE title = 'Moto X3M';