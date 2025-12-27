-- Create lifecycle status enum type
DO $$ BEGIN
  CREATE TYPE lifecycle_status_enum AS ENUM ('active', 'leaving_soon', 'hidden', 'kept');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add lifecycle columns to content table
ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS lifecycle_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS lifecycle_updated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS lifecycle_reason text,
ADD COLUMN IF NOT EXISTS admin_override boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS views_last_30_days integer DEFAULT 0;

-- Set expires_at for existing content (90 days from created_at)
UPDATE public.content 
SET expires_at = created_at + interval '90 days'
WHERE expires_at IS NULL;

-- Create content_lifecycle_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.content_lifecycle_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by text NOT NULL DEFAULT 'system',
  admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on lifecycle logs
ALTER TABLE public.content_lifecycle_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for content_lifecycle_logs
CREATE POLICY "Admins can view all lifecycle logs"
ON public.content_lifecycle_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert lifecycle logs"
ON public.content_lifecycle_logs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can manage lifecycle logs"
ON public.content_lifecycle_logs
FOR ALL
USING (true);

-- Create function to auto-set expires_at on new content
CREATE OR REPLACE FUNCTION public.set_content_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + interval '90 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for auto-setting expires_at
DROP TRIGGER IF EXISTS set_content_expires_at_trigger ON public.content;
CREATE TRIGGER set_content_expires_at_trigger
BEFORE INSERT ON public.content
FOR EACH ROW
EXECUTE FUNCTION public.set_content_expires_at();

-- Create function to calculate views in last 30 days
CREATE OR REPLACE FUNCTION public.get_content_views_last_30_days(content_uuid uuid)
RETURNS integer AS $$
DECLARE
  view_count integer;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM public.watch_history
  WHERE content_id = content_uuid
    AND watched_at >= now() - interval '30 days';
  
  RETURN COALESCE(view_count, 0);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Create index for faster lifecycle queries
CREATE INDEX IF NOT EXISTS idx_content_lifecycle_status ON public.content(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_content_expires_at ON public.content(expires_at);
CREATE INDEX IF NOT EXISTS idx_content_lifecycle_logs_content_id ON public.content_lifecycle_logs(content_id);