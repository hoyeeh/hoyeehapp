GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT ALL ON public.profiles_safe TO service_role;