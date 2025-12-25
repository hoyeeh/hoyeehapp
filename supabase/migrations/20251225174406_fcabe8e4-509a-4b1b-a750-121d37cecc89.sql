-- Watch Parties table for real-time sync
CREATE TABLE public.watch_parties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.episodes(id) ON DELETE SET NULL,
  party_code VARCHAR(8) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  playback_time NUMERIC DEFAULT 0,
  is_playing BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Watch party members
CREATE TABLE public.watch_party_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id UUID NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_ready BOOLEAN DEFAULT false,
  UNIQUE(party_id, user_id)
);

-- Series watch tracking for notifications
CREATE TABLE public.series_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS
ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_subscriptions ENABLE ROW LEVEL SECURITY;

-- Watch parties policies
CREATE POLICY "Users can view active parties they're in" ON public.watch_parties
FOR SELECT USING (
  is_active = true AND (
    host_user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.watch_party_members WHERE party_id = id AND user_id = auth.uid())
  )
);

CREATE POLICY "Users can create parties" ON public.watch_parties
FOR INSERT WITH CHECK (host_user_id = auth.uid());

CREATE POLICY "Hosts can update their parties" ON public.watch_parties
FOR UPDATE USING (host_user_id = auth.uid());

CREATE POLICY "Hosts can delete their parties" ON public.watch_parties
FOR DELETE USING (host_user_id = auth.uid());

-- Watch party members policies
CREATE POLICY "Members can view party members" ON public.watch_party_members
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.watch_parties WHERE id = party_id AND (host_user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.watch_party_members wpm WHERE wpm.party_id = party_id AND wpm.user_id = auth.uid())))
);

CREATE POLICY "Users can join parties" ON public.watch_party_members
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own membership" ON public.watch_party_members
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can leave parties" ON public.watch_party_members
FOR DELETE USING (user_id = auth.uid());

-- Series subscriptions policies
CREATE POLICY "Users can view their subscriptions" ON public.series_subscriptions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can subscribe to series" ON public.series_subscriptions
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unsubscribe" ON public.series_subscriptions
FOR DELETE USING (user_id = auth.uid());

-- Enable realtime for watch parties
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_parties;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_members;

-- Function to generate unique party code
CREATE OR REPLACE FUNCTION generate_party_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(8) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;