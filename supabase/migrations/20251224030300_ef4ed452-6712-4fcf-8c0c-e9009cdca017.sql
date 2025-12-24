-- Create creator_kyc table for KYC verification
CREATE TABLE public.creator_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  nationality TEXT,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  address_line1 TEXT,
  address_city TEXT,
  address_country TEXT,
  id_type TEXT NOT NULL CHECK (id_type IN ('national_id', 'drivers_license', 'passport')),
  id_number TEXT NOT NULL,
  id_document_url TEXT NOT NULL,
  id_expiry_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id)
);

-- Create creator_content_submissions table
CREATE TABLE public.creator_content_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.content(id),
  title TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  content_type TEXT DEFAULT 'movie',
  age_group TEXT CHECK (age_group IN ('G', 'PG', 'PG-13', 'R', '18+')),
  release_date DATE,
  price_per_view NUMERIC DEFAULT 0,
  video_url TEXT,
  cover_image_url TEXT,
  poster_image_url TEXT,
  duration INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add KYC columns to creator_profiles
ALTER TABLE public.creator_profiles 
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'not_started' CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'declined')),
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS can_request_payout BOOLEAN DEFAULT false;

-- Enable RLS on new tables
ALTER TABLE public.creator_kyc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_content_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for creator_kyc
CREATE POLICY "Creators can view their own KYC" ON public.creator_kyc
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_kyc.creator_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Creators can insert their own KYC" ON public.creator_kyc
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_kyc.creator_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Creators can update their own KYC" ON public.creator_kyc
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_kyc.creator_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all KYC" ON public.creator_kyc
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all KYC" ON public.creator_kyc
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- RLS policies for creator_content_submissions
CREATE POLICY "Creators can view their own submissions" ON public.creator_content_submissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_content_submissions.creator_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Creators can insert their own submissions" ON public.creator_content_submissions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_content_submissions.creator_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Creators can update their own submissions" ON public.creator_content_submissions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM creator_profiles cp WHERE cp.id = creator_content_submissions.creator_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Admins can view all submissions" ON public.creator_content_submissions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all submissions" ON public.creator_content_submissions
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Create storage bucket for creator uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('creator-uploads', 'creator-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for creator uploads
CREATE POLICY "Creators can upload to their folder" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'creator-uploads' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Creators can view their uploads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'creator-uploads' AND 
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can view all creator uploads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'creator-uploads' AND 
    has_role(auth.uid(), 'admin')
  );

-- Create indexes for performance
CREATE INDEX idx_creator_kyc_creator_id ON public.creator_kyc(creator_id);
CREATE INDEX idx_creator_kyc_status ON public.creator_kyc(status);
CREATE INDEX idx_creator_content_submissions_creator_id ON public.creator_content_submissions(creator_id);
CREATE INDEX idx_creator_content_submissions_status ON public.creator_content_submissions(status);