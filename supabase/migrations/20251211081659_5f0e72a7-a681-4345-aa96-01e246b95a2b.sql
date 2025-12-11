-- Add bedtime_time field to user_profiles for kids bedtime mode
ALTER TABLE public.user_profiles 
ADD COLUMN bedtime_time TIME DEFAULT NULL;

-- Insert yearly subscription plan
INSERT INTO public.subscription_settings (plan_type, base_price, currency, description, is_active)
VALUES ('yearly', 20000, 'XAF', 'Yearly subscription - Best value! Save 17%', true)
ON CONFLICT DO NOTHING;