-- Create watch party messages table for chat feature
CREATE TABLE public.watch_party_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.watch_party_messages ENABLE ROW LEVEL SECURITY;

-- Members can view messages from parties they're in
CREATE POLICY "Members can view party messages"
ON public.watch_party_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.watch_party_members wpm
    WHERE wpm.party_id = watch_party_messages.party_id
    AND wpm.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.watch_parties wp
    WHERE wp.id = watch_party_messages.party_id
    AND wp.host_user_id = auth.uid()
  )
);

-- Members can insert messages to parties they're in
CREATE POLICY "Members can send party messages"
ON public.watch_party_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.watch_party_members wpm
      WHERE wpm.party_id = watch_party_messages.party_id
      AND wpm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.watch_parties wp
      WHERE wp.id = watch_party_messages.party_id
      AND wp.host_user_id = auth.uid()
    )
  )
);

-- Enable realtime for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_messages;