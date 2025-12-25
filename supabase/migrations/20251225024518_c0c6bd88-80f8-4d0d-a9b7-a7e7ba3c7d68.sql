-- Create table for parental content approval
CREATE TABLE public.kids_approved_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  approved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(profile_id, content_id)
);

-- Enable RLS
ALTER TABLE public.kids_approved_content ENABLE ROW LEVEL SECURITY;

-- Parents can manage approvals for their kids' profiles
CREATE POLICY "Parents can view approvals for their kids"
ON public.kids_approved_content
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = kids_approved_content.profile_id
    AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can add approvals for their kids"
ON public.kids_approved_content
FOR INSERT
WITH CHECK (
  auth.uid() = parent_user_id
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = kids_approved_content.profile_id
    AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Parents can remove approvals for their kids"
ON public.kids_approved_content
FOR DELETE
USING (
  auth.uid() = parent_user_id
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = kids_approved_content.profile_id
    AND up.user_id = auth.uid()
  )
);

-- Admins can view all approvals
CREATE POLICY "Admins can view all approvals"
ON public.kids_approved_content
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add require_approval column to user_profiles for kids profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS require_parent_approval BOOLEAN DEFAULT false;

-- Add index for faster lookups
CREATE INDEX idx_kids_approved_content_profile ON public.kids_approved_content(profile_id);
CREATE INDEX idx_kids_approved_content_content ON public.kids_approved_content(content_id);