-- Create user profiles table (sub-accounts, up to 5 per user)
CREATE TABLE public.user_profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    is_kids BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profiles
CREATE POLICY "Users can view their own profiles"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create profiles (max 5 enforced in app)
CREATE POLICY "Users can create their own profiles"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own profiles
CREATE POLICY "Users can update their own profiles"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own profiles
CREATE POLICY "Users can delete their own profiles"
ON public.user_profiles
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add watch preferences table for AI recommendations
CREATE TABLE public.profile_watch_preferences (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    genre TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index
CREATE INDEX idx_profile_watch_preferences_profile_id ON public.profile_watch_preferences(profile_id);

-- Enable RLS
ALTER TABLE public.profile_watch_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their profile preferences
CREATE POLICY "Users can view their profile preferences"
ON public.profile_watch_preferences
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = profile_watch_preferences.profile_id
    AND user_profiles.user_id = auth.uid()
));

CREATE POLICY "Users can insert their profile preferences"
ON public.profile_watch_preferences
FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = profile_watch_preferences.profile_id
    AND user_profiles.user_id = auth.uid()
));

CREATE POLICY "Users can update their profile preferences"
ON public.profile_watch_preferences
FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = profile_watch_preferences.profile_id
    AND user_profiles.user_id = auth.uid()
));

CREATE POLICY "Users can delete their profile preferences"
ON public.profile_watch_preferences
FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = profile_watch_preferences.profile_id
    AND user_profiles.user_id = auth.uid()
));