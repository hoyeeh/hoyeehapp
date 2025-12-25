-- Create rate_limits table for persistent rate limiting across edge functions
CREATE TABLE public.rate_limits (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow users to read/write their own rate limit data (used by edge functions with service role)
CREATE POLICY "Rate limits are managed by system"
ON public.rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Create user_devices table to track and limit device registrations
CREATE TABLE public.user_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (user_id, device_id)
);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own devices
CREATE POLICY "Users can view their own devices"
ON public.user_devices
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to register devices (with limit enforced in application)
CREATE POLICY "Users can register devices"
ON public.user_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own devices
CREATE POLICY "Users can update their own devices"
ON public.user_devices
FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own devices
CREATE POLICY "Users can delete their own devices"
ON public.user_devices
FOR DELETE
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_rate_limits_user_action ON public.rate_limits (user_id, action);
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits (window_start);
CREATE INDEX idx_user_devices_user_id ON public.user_devices (user_id);
CREATE INDEX idx_user_devices_device_id ON public.user_devices (device_id);