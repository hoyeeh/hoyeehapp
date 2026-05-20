
-- 1. Restrict video_url column from anonymous role on content & episodes
REVOKE SELECT (video_url) ON public.content FROM anon;
REVOKE SELECT (video_url) ON public.episodes FROM anon;

-- Grant explicit per-column SELECT to anon for non-sensitive columns by leaving table-level grant for authenticated only on video_url
-- (Other columns remain readable by anon via existing table grant.)

-- 2. Realtime authorization: add RLS policies on realtime.messages for private channels
-- These policies apply only to private channels (the default broadcast/presence channels are unaffected).

DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_write" ON realtime.messages;

CREATE POLICY "realtime_authenticated_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'party-%'
      OR realtime.topic() LIKE 'watch-party-%'
      OR realtime.topic() LIKE 'watch-party-reactions-%'
      THEN public.is_party_member(
        auth.uid(),
        NULLIF(substring(realtime.topic() from '[0-9a-fA-F-]{36}$'), '')::uuid
      )
    WHEN realtime.topic() LIKE 'ticket-%' THEN
      EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = NULLIF(substring(realtime.topic() from 8), '')::uuid
          AND (t.user_id = auth.uid()
               OR t.assigned_to = auth.uid()
               OR public.has_role(auth.uid(), 'admin'::app_role)
               OR public.is_super_admin(auth.uid()))
      )
    WHEN realtime.topic() LIKE 'cast-controller-%'
      OR realtime.topic() LIKE 'cast-session-%'
      OR realtime.topic() LIKE 'cast-receiver-%' THEN
      EXISTS (
        SELECT 1 FROM public.cast_sessions cs
        WHERE cs.id = NULLIF(substring(realtime.topic() from '[0-9a-fA-F-]{36}$'), '')::uuid
          AND (cs.controller_user_id = auth.uid()
               OR cs.receiver_id IN (
                 SELECT id FROM public.cast_receivers WHERE user_id = auth.uid()
               ))
      )
    WHEN realtime.topic() LIKE 'admin-%' THEN
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_super_admin(auth.uid())
    WHEN realtime.topic() IN (
      'home-sections-changes',
      'section-content-changes',
      'content-changes',
      'top10-changes',
      'hero-banners-changes',
      'smart-download-listener'
    ) THEN true
    ELSE false
  END
);

CREATE POLICY "realtime_authenticated_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'party-%'
      OR realtime.topic() LIKE 'watch-party-%'
      OR realtime.topic() LIKE 'watch-party-reactions-%'
      THEN public.is_party_member(
        auth.uid(),
        NULLIF(substring(realtime.topic() from '[0-9a-fA-F-]{36}$'), '')::uuid
      )
    WHEN realtime.topic() LIKE 'ticket-%' THEN
      EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = NULLIF(substring(realtime.topic() from 8), '')::uuid
          AND (t.user_id = auth.uid()
               OR t.assigned_to = auth.uid()
               OR public.has_role(auth.uid(), 'admin'::app_role)
               OR public.is_super_admin(auth.uid()))
      )
    WHEN realtime.topic() LIKE 'cast-controller-%'
      OR realtime.topic() LIKE 'cast-session-%'
      OR realtime.topic() LIKE 'cast-receiver-%' THEN
      EXISTS (
        SELECT 1 FROM public.cast_sessions cs
        WHERE cs.id = NULLIF(substring(realtime.topic() from '[0-9a-fA-F-]{36}$'), '')::uuid
          AND (cs.controller_user_id = auth.uid()
               OR cs.receiver_id IN (
                 SELECT id FROM public.cast_receivers WHERE user_id = auth.uid()
               ))
      )
    WHEN realtime.topic() LIKE 'admin-%' THEN
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_super_admin(auth.uid())
    ELSE false
  END
);
