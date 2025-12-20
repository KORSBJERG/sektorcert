-- Create storage bucket for security reports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('security-reports', 'security-reports', false);

-- Create RLS policies for the bucket
CREATE POLICY "Users can upload their own security reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'security-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own security reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'security-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own security reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'security-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create table to store security report metadata and AI analysis results
CREATE TABLE public.security_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_by_user_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  report_type TEXT DEFAULT 'microsoft_365_baseline',
  analysis_status TEXT DEFAULT 'pending',
  analysis_result JSONB,
  secure_score_current NUMERIC,
  secure_score_predicted NUMERIC,
  overall_status_percentage NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own security reports"
ON public.security_reports FOR SELECT
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create security reports"
ON public.security_reports FOR INSERT
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own security reports"
ON public.security_reports FOR UPDATE
USING (created_by_user_id = auth.uid())
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own security reports"
ON public.security_reports FOR DELETE
USING (created_by_user_id = auth.uid());

-- Create table to link report findings to assessment items
CREATE TABLE public.security_report_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  security_report_id UUID NOT NULL REFERENCES public.security_reports(id) ON DELETE CASCADE,
  assessment_item_id UUID REFERENCES public.assessment_items(id) ON DELETE SET NULL,
  recommendation_id INTEGER REFERENCES public.recommendations(id),
  report_recommendation_name TEXT NOT NULL,
  report_status TEXT,
  match_confidence NUMERIC,
  suggested_maturity_level INTEGER,
  applied BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_report_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies for matches
CREATE POLICY "Users can view matches for their reports"
ON public.security_report_matches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.security_reports sr
    WHERE sr.id = security_report_matches.security_report_id
    AND sr.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can create matches for their reports"
ON public.security_report_matches FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.security_reports sr
    WHERE sr.id = security_report_matches.security_report_id
    AND sr.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update matches for their reports"
ON public.security_report_matches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.security_reports sr
    WHERE sr.id = security_report_matches.security_report_id
    AND sr.created_by_user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_security_reports_updated_at
BEFORE UPDATE ON public.security_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();