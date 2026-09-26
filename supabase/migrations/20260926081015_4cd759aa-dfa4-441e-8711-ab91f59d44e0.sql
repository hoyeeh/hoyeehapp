DROP POLICY IF EXISTS "Users can update their own download licenses" ON public.download_licenses;
DROP POLICY IF EXISTS "Users can insert their own download licenses" ON public.download_licenses;
REVOKE INSERT, UPDATE ON public.download_licenses FROM authenticated, anon;
GRANT SELECT, DELETE ON public.download_licenses TO authenticated;
GRANT ALL ON public.download_licenses TO service_role;

CREATE OR REPLACE FUNCTION public.complete_download_license(_content_id uuid, _episode_id uuid, _device_id text, _total_size bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean;
BEGIN
  IF auth.uid() IS NULL OR _total_size IS NULL OR _total_size <= 0 THEN RETURN false; END IF;
  UPDATE public.download_licenses SET status = 'completed', downloaded_at = now(), total_size = _total_size
   WHERE user_id = auth.uid() AND content_id = _content_id AND device_id = _device_id
     AND episode_id IS NOT DISTINCT FROM _episode_id
     AND status = 'pending' AND expires_at > now()
  RETURNING true INTO v_ok;
  RETURN COALESCE(v_ok, false);
END $$;
REVOKE ALL ON FUNCTION public.complete_download_license(uuid, uuid, text, bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_download_license(uuid, uuid, text, bigint) TO authenticated;