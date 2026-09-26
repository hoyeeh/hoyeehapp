DROP POLICY IF EXISTS "Authenticated users can view follower relationships" ON public.creator_followers;
CREATE POLICY "Followers, creators and admins can view follow relationships" ON public.creator_followers
FOR SELECT TO authenticated USING (
  follower_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.creator_profiles cp WHERE cp.id = creator_followers.creator_id AND cp.user_id = auth.uid())
  OR public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can view platform settings" ON public.platform_settings;
CREATE POLICY "Signed-in users can view app-facing platform settings" ON public.platform_settings
FOR SELECT TO authenticated USING (
  setting_key IN ('home_enable_deduplication','subtitle_languages','minimum_content_price','creator_commission_percent','platform_commission_percent','minimum_payout_amount')
  OR public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Anyone can view subscription settings" ON public.subscription_settings;
CREATE POLICY "Anyone can view active subscription plans" ON public.subscription_settings
FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Users can list their own avatar files" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Walkthrough images are publicly accessible" ON storage.objects;
CREATE POLICY "Admins can list walkthrough images" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'walkthrough-images' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Public can view game covers" ON storage.objects;
CREATE POLICY "Admins can list game covers" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'playable-covers' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Anyone can view subtitles" ON storage.objects;
CREATE POLICY "Admins can list subtitle files" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'subtitles' AND public.has_role(auth.uid(),'admin'));