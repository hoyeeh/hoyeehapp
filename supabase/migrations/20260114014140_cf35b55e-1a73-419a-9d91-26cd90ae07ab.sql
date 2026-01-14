-- Add subtitle language configuration to platform_settings
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES (
  'subtitle_languages',
  '["eng", "fra", "yor", "hau", "swa", "amh", "zul", "spa", "por"]',
  'Languages for auto-generated subtitles. Array of ISO 639-3 codes.'
)
ON CONFLICT (setting_key) DO NOTHING;

-- Add speaker_labels and storage_provider columns to subtitles table
ALTER TABLE public.subtitles 
ADD COLUMN IF NOT EXISTS storage_provider text DEFAULT 'do_spaces',
ADD COLUMN IF NOT EXISTS speaker_labels jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS manually_edited boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Create subtitle_edit_history table for tracking changes
CREATE TABLE IF NOT EXISTS public.subtitle_edit_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtitle_id uuid NOT NULL REFERENCES public.subtitles(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL REFERENCES auth.users(id),
  previous_content text,
  new_content text,
  edit_type text NOT NULL CHECK (edit_type IN ('timing', 'text', 'speaker_label', 'full')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on subtitle_edit_history
ALTER TABLE public.subtitle_edit_history ENABLE ROW LEVEL SECURITY;

-- Policy: Creators can view their own subtitle edit history
CREATE POLICY "Creators can view their subtitle edit history"
ON public.subtitle_edit_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM subtitles s
    JOIN content c ON s.content_id = c.id
    JOIN creator_content_submissions ccs ON ccs.content_id = c.id
    JOIN creator_profiles cp ON cp.id = ccs.creator_id
    WHERE s.id = subtitle_edit_history.subtitle_id
    AND cp.user_id = auth.uid()
  )
  OR
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Policy: Creators can insert edit history for their own subtitles
CREATE POLICY "Creators can insert their subtitle edit history"
ON public.subtitle_edit_history
FOR INSERT
WITH CHECK (
  edited_by = auth.uid() AND (
    EXISTS (
      SELECT 1 FROM subtitles s
      JOIN content c ON s.content_id = c.id
      JOIN creator_content_submissions ccs ON ccs.content_id = c.id
      JOIN creator_profiles cp ON cp.id = ccs.creator_id
      WHERE s.id = subtitle_edit_history.subtitle_id
      AND cp.user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_subtitle_edit_history_subtitle_id ON public.subtitle_edit_history(subtitle_id);

-- Create language reference table for UI
CREATE TABLE IF NOT EXISTS public.subtitle_language_options (
  code text PRIMARY KEY,
  label text NOT NULL,
  native_label text,
  region text,
  is_african boolean DEFAULT false,
  display_order int DEFAULT 100
);

-- Insert language options
INSERT INTO public.subtitle_language_options (code, label, native_label, region, is_african, display_order)
VALUES 
  ('eng', 'English', 'English', 'Global', false, 1),
  ('fra', 'French', 'Français', 'Global', false, 2),
  ('yor', 'Yoruba', 'Yorùbá', 'Nigeria', true, 10),
  ('hau', 'Hausa', 'Hausa', 'Nigeria/Niger', true, 11),
  ('ibo', 'Igbo', 'Igbo', 'Nigeria', true, 12),
  ('swa', 'Swahili', 'Kiswahili', 'East Africa', true, 13),
  ('amh', 'Amharic', 'አማርኛ', 'Ethiopia', true, 14),
  ('zul', 'Zulu', 'isiZulu', 'South Africa', true, 15),
  ('xho', 'Xhosa', 'isiXhosa', 'South Africa', true, 16),
  ('twi', 'Twi', 'Twi', 'Ghana', true, 17),
  ('wol', 'Wolof', 'Wolof', 'Senegal', true, 18),
  ('lin', 'Lingala', 'Lingála', 'DRC/Congo', true, 19),
  ('spa', 'Spanish', 'Español', 'Europe', false, 30),
  ('por', 'Portuguese', 'Português', 'Europe', false, 31),
  ('deu', 'German', 'Deutsch', 'Europe', false, 32),
  ('ita', 'Italian', 'Italiano', 'Europe', false, 33),
  ('ara', 'Arabic', 'العربية', 'MENA', false, 40),
  ('zho', 'Chinese', '中文', 'Asia', false, 50),
  ('hin', 'Hindi', 'हिन्दी', 'Asia', false, 51),
  ('jpn', 'Japanese', '日本語', 'Asia', false, 52)
ON CONFLICT (code) DO NOTHING;

-- Allow public read access to language options
ALTER TABLE public.subtitle_language_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view language options"
ON public.subtitle_language_options
FOR SELECT
USING (true);