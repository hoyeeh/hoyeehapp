
-- 1) Tighten download_licenses INSERT: require active subscription OR completed purchase
DROP POLICY IF EXISTS "Users can insert their own download licenses" ON public.download_licenses;

CREATE POLICY "Users can insert their own download licenses"
ON public.download_licenses
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_subscribed = true
        AND (p.subscription_expiry IS NULL OR p.subscription_expiry > now())
    )
    OR (
      content_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.content_purchases cp
        WHERE cp.user_id = auth.uid()
          AND cp.content_id = download_licenses.content_id
          AND cp.status = 'completed'
      )
    )
    OR (
      episode_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.content_purchases cp
        JOIN public.episodes e ON e.id = download_licenses.episode_id
        JOIN public.seasons s ON s.id = e.season_id
        WHERE cp.user_id = auth.uid()
          AND cp.content_id = s.content_id
          AND cp.status = 'completed'
      )
    )
  )
);

-- 2) Tighten tv_telemetry INSERT with event allowlist and size limits
DROP POLICY IF EXISTS "Anyone can insert tv telemetry" ON public.tv_telemetry;

CREATE POLICY "Anyone can insert tv telemetry"
ON public.tv_telemetry
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event = ANY (ARRAY[
    'redirect_fired',
    'receiver_boot',
    'polyfills_ready',
    'pairing_visible',
    'pairing_failed',
    'pairing_success',
    'receiver_error',
    'compat_failed'
  ])
  AND char_length(event) <= 64
  AND (user_agent IS NULL OR char_length(user_agent) <= 1000)
  AND (url IS NULL OR char_length(url) <= 2048)
  AND (session_id IS NULL OR char_length(session_id) <= 128)
  AND (pairing_code IS NULL OR char_length(pairing_code) <= 32)
  AND (details IS NULL OR pg_column_size(details) <= 4096)
);

-- 3) Pin search_path on email-queue wrapper functions
ALTER FUNCTION public.read_email_batch(text, integer, integer)
  SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint)
  SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb)
  SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)
  SET search_path = public, pgmq;
