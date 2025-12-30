-- Create huntress_escalations table
CREATE TABLE public.huntress_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  huntress_escalation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT,
  severity TEXT,
  affected_host TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  detected_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB
);

-- Enable RLS on huntress_escalations
ALTER TABLE public.huntress_escalations ENABLE ROW LEVEL SECURITY;

-- RLS policies for huntress_escalations
CREATE POLICY "Users can view escalations for their integrations"
  ON public.huntress_escalations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_escalations.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create escalations for their integrations"
  ON public.huntress_escalations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_escalations.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete escalations for their integrations"
  ON public.huntress_escalations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_escalations.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

-- Create huntress_billing table
CREATE TABLE public.huntress_billing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  period_start DATE,
  period_end DATE,
  endpoints_count INTEGER,
  total_amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  raw_data JSONB
);

-- Enable RLS on huntress_billing
ALTER TABLE public.huntress_billing ENABLE ROW LEVEL SECURITY;

-- RLS policies for huntress_billing
CREATE POLICY "Users can view billing for their integrations"
  ON public.huntress_billing FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_billing.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create billing for their integrations"
  ON public.huntress_billing FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_billing.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete billing for their integrations"
  ON public.huntress_billing FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_billing.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

-- Create huntress_summary_reports table
CREATE TABLE public.huntress_summary_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  huntress_report_id TEXT NOT NULL,
  report_period TEXT,
  report_type TEXT,
  summary_data JSONB,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB
);

-- Enable RLS on huntress_summary_reports
ALTER TABLE public.huntress_summary_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for huntress_summary_reports
CREATE POLICY "Users can view summary reports for their integrations"
  ON public.huntress_summary_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_summary_reports.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create summary reports for their integrations"
  ON public.huntress_summary_reports FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_summary_reports.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete summary reports for their integrations"
  ON public.huntress_summary_reports FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM huntress_integrations hi
    WHERE hi.id = huntress_summary_reports.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

-- Extend huntress_agents with more fields
ALTER TABLE public.huntress_agents 
  ADD COLUMN IF NOT EXISTS last_survey_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS agent_version TEXT,
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- Extend huntress_incidents with more fields
ALTER TABLE public.huntress_incidents 
  ADD COLUMN IF NOT EXISTS affected_hosts TEXT[],
  ADD COLUMN IF NOT EXISTS remediation_steps TEXT,
  ADD COLUMN IF NOT EXISTS indicators JSONB,
  ADD COLUMN IF NOT EXISTS timeline JSONB;

-- Update sync_options default to include new types
ALTER TABLE public.huntress_integrations 
  ALTER COLUMN sync_options SET DEFAULT '{"agents": true, "reports": true, "signals": true, "incidents": true, "escalations": true, "billing": false, "summaries": true}'::jsonb;