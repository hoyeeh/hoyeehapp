ALTER VIEW public.content_public SET (security_invoker = off);
ALTER VIEW public.episodes_public SET (security_invoker = off);
GRANT SELECT ON public.content_public TO anon, authenticated;
GRANT SELECT ON public.episodes_public TO anon, authenticated;