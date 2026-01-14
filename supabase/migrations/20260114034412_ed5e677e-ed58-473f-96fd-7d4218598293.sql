-- Create kids_content_restrictions table for both approvals and blocks
CREATE TABLE IF NOT EXISTS public.kids_content_restrictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  parent_user_id UUID NOT NULL,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('approved', 'blocked')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(profile_id, content_id)
);

-- Enable RLS
ALTER TABLE public.kids_content_restrictions ENABLE ROW LEVEL SECURITY;

-- Parents can view restrictions for their own kids
CREATE POLICY "Parents can view their kids restrictions"
ON public.kids_content_restrictions
FOR SELECT
USING (parent_user_id = auth.uid());

-- Parents can create restrictions for their own kids
CREATE POLICY "Parents can create restrictions for their kids"
ON public.kids_content_restrictions
FOR INSERT
WITH CHECK (parent_user_id = auth.uid());

-- Parents can update restrictions for their own kids
CREATE POLICY "Parents can update their kids restrictions"
ON public.kids_content_restrictions
FOR UPDATE
USING (parent_user_id = auth.uid());

-- Parents can delete restrictions for their own kids
CREATE POLICY "Parents can delete their kids restrictions"
ON public.kids_content_restrictions
FOR DELETE
USING (parent_user_id = auth.uid());

-- Admins can view all restrictions
CREATE POLICY "Admins can view all restrictions"
ON public.kids_content_restrictions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_kids_content_restrictions_profile ON public.kids_content_restrictions(profile_id);
CREATE INDEX idx_kids_content_restrictions_content ON public.kids_content_restrictions(content_id);
CREATE INDEX idx_kids_content_restrictions_parent ON public.kids_content_restrictions(parent_user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_kids_content_restrictions_updated_at
BEFORE UPDATE ON public.kids_content_restrictions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();