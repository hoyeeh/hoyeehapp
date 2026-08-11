CREATE TABLE public.external_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'tmdb',
  tmdb_id integer NOT NULL,
  imdb_id text,
  title text NOT NULL,
  media_type text NOT NULL,
  release_year integer,
  genres text[] NOT NULL DEFAULT '{}',
  popularity numeric NOT NULL DEFAULT 0,
  vote_average numeric NOT NULL DEFAULT 0,
  trend_rank integer NOT NULL DEFAULT 0,
  trend_window text NOT NULL DEFAULT 'day',
  poster_path text,
  content_id uuid REFERENCES public.content(id) ON DELETE SET NULL,
  is_owned boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, tmdb_id, media_type, trend_window)
);

CREATE INDEX idx_external_trends_window_rank ON public.external_trends (trend_window, trend_rank);
CREATE INDEX idx_external_trends_owned ON public.external_trends (is_owned);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_trends TO authenticated;
GRANT ALL ON public.external_trends TO service_role;
ALTER TABLE public.external_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view external trends" ON public.external_trends
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins can manage external trends" ON public.external_trends
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TABLE public.ai_homepage_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autopilot_enabled boolean NOT NULL DEFAULT false,
  confidence_threshold integer NOT NULL DEFAULT 8,
  allowed_types text[] NOT NULL DEFAULT ARRAY['content_swap']::text[],
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_homepage_settings TO authenticated;
GRANT ALL ON public.ai_homepage_settings TO service_role;
ALTER TABLE public.ai_homepage_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai homepage settings" ON public.ai_homepage_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins can manage ai homepage settings" ON public.ai_homepage_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_ai_homepage_settings_updated_at
  BEFORE UPDATE ON public.ai_homepage_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_homepage_settings (autopilot_enabled) VALUES (false);

CREATE TABLE public.ai_homepage_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id uuid REFERENCES public.homepage_ai_suggestions(id) ON DELETE SET NULL,
  suggestion_type text NOT NULL,
  target_section_id uuid,
  applied_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_by uuid,
  auto_applied boolean NOT NULL DEFAULT false,
  reverted_at timestamptz,
  reverted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_homepage_change_log_created ON public.ai_homepage_change_log (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_homepage_change_log TO authenticated;
GRANT ALL ON public.ai_homepage_change_log TO service_role;
ALTER TABLE public.ai_homepage_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai homepage change log" ON public.ai_homepage_change_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins can manage ai homepage change log" ON public.ai_homepage_change_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));