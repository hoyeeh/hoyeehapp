UPDATE public.home_sections hs
SET source = 'ai'
WHERE hs.id IN (
  SELECT (l.previous_state->>'created_section_id')::uuid
  FROM public.ai_homepage_change_log l
  WHERE l.suggestion_type = 'new_section'
    AND l.previous_state->>'created_section_id' IS NOT NULL
);

UPDATE public.home_sections SET is_active = false WHERE source = 'ai' AND is_active = true;

UPDATE public.homepage_layout_state SET mode = 'manual', switched_at = now();