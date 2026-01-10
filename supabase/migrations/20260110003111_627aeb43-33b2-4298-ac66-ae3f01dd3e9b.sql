-- Add profile_id column to watch_history for profile-specific watch history
ALTER TABLE watch_history ADD COLUMN profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_watch_history_profile ON watch_history(profile_id);

-- Add profile_id to kids_viewing_history as well for consistency
-- (kids_viewing_history already has profile_id, so this is just for watch_history)