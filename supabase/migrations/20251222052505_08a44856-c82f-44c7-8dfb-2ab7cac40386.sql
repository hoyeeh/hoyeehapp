-- Create email campaigns table
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'custom',
  html_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  campaign_type TEXT NOT NULL DEFAULT 'one-time',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  target_audience TEXT NOT NULL DEFAULT 'all',
  filters JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create drip sequences table
CREATE TABLE public.drip_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_event TEXT NOT NULL DEFAULT 'signup',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create drip sequence steps table
CREATE TABLE public.drip_sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.drip_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'custom',
  html_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user drip enrollment table
CREATE TABLE public.user_drip_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sequence_id UUID NOT NULL REFERENCES public.drip_sequences(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_email_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, sequence_id)
);

-- Create scheduled emails queue table
CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_drip_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Admin policies for email_campaigns
CREATE POLICY "Admins can view all campaigns" ON public.email_campaigns
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can create campaigns" ON public.email_campaigns
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update campaigns" ON public.email_campaigns
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete campaigns" ON public.email_campaigns
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Admin policies for drip_sequences
CREATE POLICY "Admins can view all sequences" ON public.drip_sequences
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can create sequences" ON public.drip_sequences
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update sequences" ON public.drip_sequences
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete sequences" ON public.drip_sequences
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Admin policies for drip_sequence_steps
CREATE POLICY "Admins can view all steps" ON public.drip_sequence_steps
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can create steps" ON public.drip_sequence_steps
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can update steps" ON public.drip_sequence_steps
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can delete steps" ON public.drip_sequence_steps
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- Admin policies for user_drip_enrollments
CREATE POLICY "Admins can view enrollments" ON public.user_drip_enrollments
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role can manage enrollments" ON public.user_drip_enrollments
FOR ALL USING (true);

-- Admin policies for scheduled_emails
CREATE POLICY "Admins can view scheduled emails" ON public.scheduled_emails
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Service role can manage scheduled emails" ON public.scheduled_emails
FOR ALL USING (true);

-- Create indexes for performance
CREATE INDEX idx_scheduled_emails_status_time ON public.scheduled_emails(status, scheduled_for);
CREATE INDEX idx_user_drip_enrollments_next ON public.user_drip_enrollments(status, next_email_at);
CREATE INDEX idx_drip_sequence_steps_order ON public.drip_sequence_steps(sequence_id, step_order);