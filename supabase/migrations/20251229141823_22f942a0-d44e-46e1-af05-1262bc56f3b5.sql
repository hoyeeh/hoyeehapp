-- Add tracking columns for translation and source type
ALTER TABLE subtitles 
ADD COLUMN IF NOT EXISTS is_translated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS source_subtitle_id UUID REFERENCES subtitles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- Add comment for documentation
COMMENT ON COLUMN subtitles.is_translated IS 'Whether this subtitle was translated from another language';
COMMENT ON COLUMN subtitles.source_subtitle_id IS 'Reference to the original subtitle this was translated from';
COMMENT ON COLUMN subtitles.source_type IS 'How the subtitle was created: manual, generated, or translated';