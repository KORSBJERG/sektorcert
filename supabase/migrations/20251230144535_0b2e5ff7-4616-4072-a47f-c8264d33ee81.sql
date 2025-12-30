-- Create table for Huntress reports
CREATE TABLE public.huntress_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  huntress_report_id TEXT NOT NULL,
  report_type TEXT,
  generated_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(huntress_integration_id, huntress_report_id)
);

-- Create table for Huntress signals
CREATE TABLE public.huntress_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  huntress_signal_id TEXT NOT NULL,
  signal_type TEXT,
  hostname TEXT,
  detected_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(huntress_integration_id, huntress_signal_id)
);

-- Add sync preferences column to huntress_integrations
ALTER TABLE public.huntress_integrations
ADD COLUMN sync_options JSONB DEFAULT '{"incidents": true, "agents": true, "reports": true, "signals": true}'::jsonb;

-- Enable RLS
ALTER TABLE public.huntress_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huntress_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies for huntress_reports
CREATE POLICY "Users can view reports for their integrations"
ON public.huntress_reports
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM huntress_integrations hi
  WHERE hi.id = huntress_reports.huntress_integration_id
  AND hi.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create reports for their integrations"
ON public.huntress_reports
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM huntress_integrations hi
  WHERE hi.id = huntress_reports.huntress_integration_id
  AND hi.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete reports for their integrations"
ON public.huntress_reports
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM huntress_integrations hi
  WHERE hi.id = huntress_reports.huntress_integration_id
  AND hi.created_by_user_id = auth.uid()
));

-- RLS policies for huntress_signals
CREATE POLICY "Users can view signals for their integrations"
ON public.huntress_signals
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM huntress_integrations hi
  WHERE hi.id = huntress_signals.huntress_integration_id
  AND hi.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can create signals for their integrations"
ON public.huntress_signals
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM huntress_integrations hi
  WHERE hi.id = huntress_signals.huntress_integration_id
  AND hi.created_by_user_id = auth.uid()
));

CREATE POLICY "Users can delete signals for their integrations"
ON public.huntress_signals
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM huntress_integrations hi
  WHERE hi.id = huntress_signals.huntress_integration_id
  AND hi.created_by_user_id = auth.uid()
));