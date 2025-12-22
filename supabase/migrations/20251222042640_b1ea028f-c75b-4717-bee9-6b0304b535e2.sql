-- Add kids notification preferences to notification_preferences table
ALTER TABLE public.notification_preferences 
ADD COLUMN IF NOT EXISTS kids_time_limit_alerts boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS kids_bedtime_alerts boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS kids_weekly_report boolean NOT NULL DEFAULT true;