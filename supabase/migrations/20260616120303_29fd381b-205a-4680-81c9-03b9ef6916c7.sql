-- AI Homepage Suggestions table
CREATE TABLE IF NOT EXISTS public.homepage_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type text NOT NULL CHECK (suggestion_type IN ('heal','new_section','reorder','content_swap')),
  target_section_id uuid NULL REFERENCES public.home_sections(id) ON DELETE CASCADE,
  proposed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  priority integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','applied','expired')),
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  applied_at timestamptz NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_ai_suggestions TO authenticated;
GRANT ALL ON public.homepage_ai_suggestions TO service_role;

ALTER TABLE public.homepage_ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read suggestions"
  ON public.homepage_ai_suggestions FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_super_admin(auth.uid()));

CREATE POLICY "Admins update suggestions"
  ON public.homepage_ai_suggestions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin') OR is_super_admin(auth.uid()));

CREATE POLICY "Admins delete suggestions"
  ON public.homepage_ai_suggestions FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_super_admin(auth.uid()));

CREATE TRIGGER homepage_ai_suggestions_updated_at
  BEFORE UPDATE ON public.homepage_ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_homepage_ai_suggestions_status ON public.homepage_ai_suggestions(status, created_at DESC);