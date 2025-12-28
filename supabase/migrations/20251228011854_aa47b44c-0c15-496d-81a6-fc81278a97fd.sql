-- Create channel subscriptions table for users to follow channels
CREATE TABLE public.channel_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, channel_id)
);

-- Enable Row Level Security
ALTER TABLE public.channel_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own subscriptions" 
ON public.channel_subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can subscribe to channels" 
ON public.channel_subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their subscriptions" 
ON public.channel_subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can unsubscribe from channels" 
ON public.channel_subscriptions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_channel_subscriptions_user_id ON public.channel_subscriptions(user_id);
CREATE INDEX idx_channel_subscriptions_channel_id ON public.channel_subscriptions(channel_id);