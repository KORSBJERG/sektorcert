-- Create huntress_integrations table for storing per-customer Huntress API configuration
CREATE TABLE public.huntress_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  organization_id TEXT,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_customer_huntress UNIQUE (customer_id)
);

-- Create huntress_incidents table for storing incident reports
CREATE TABLE public.huntress_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  huntress_incident_id TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE,
  remediation_status TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_huntress_incident UNIQUE (huntress_integration_id, huntress_incident_id)
);

-- Create huntress_agents table for storing agent/endpoint data
CREATE TABLE public.huntress_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  huntress_agent_id TEXT NOT NULL,
  hostname TEXT,
  os_version TEXT,
  defender_status TEXT,
  external_ip TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_huntress_agent UNIQUE (huntress_integration_id, huntress_agent_id)
);

-- Create huntress_sync_results table for storing AI analysis results
CREATE TABLE public.huntress_sync_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  huntress_integration_id UUID NOT NULL REFERENCES public.huntress_integrations(id) ON DELETE CASCADE,
  sync_date DATE NOT NULL DEFAULT CURRENT_DATE,
  incidents_count INTEGER DEFAULT 0,
  critical_incidents INTEGER DEFAULT 0,
  high_incidents INTEGER DEFAULT 0,
  medium_incidents INTEGER DEFAULT 0,
  low_incidents INTEGER DEFAULT 0,
  agents_count INTEGER DEFAULT 0,
  healthy_agents_percentage NUMERIC,
  defender_enabled_count INTEGER DEFAULT 0,
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.huntress_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huntress_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huntress_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huntress_sync_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for huntress_integrations
CREATE POLICY "Users can view their own huntress integrations"
  ON public.huntress_integrations FOR SELECT
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create huntress integrations"
  ON public.huntress_integrations FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own huntress integrations"
  ON public.huntress_integrations FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own huntress integrations"
  ON public.huntress_integrations FOR DELETE
  USING (created_by_user_id = auth.uid());

-- RLS policies for huntress_incidents (via integration ownership)
CREATE POLICY "Users can view incidents for their integrations"
  ON public.huntress_incidents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_incidents.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create incidents for their integrations"
  ON public.huntress_incidents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_incidents.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete incidents for their integrations"
  ON public.huntress_incidents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_incidents.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

-- RLS policies for huntress_agents (via integration ownership)
CREATE POLICY "Users can view agents for their integrations"
  ON public.huntress_agents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_agents.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create agents for their integrations"
  ON public.huntress_agents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_agents.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can update agents for their integrations"
  ON public.huntress_agents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_agents.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can delete agents for their integrations"
  ON public.huntress_agents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_agents.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

-- RLS policies for huntress_sync_results (via integration ownership)
CREATE POLICY "Users can view sync results for their integrations"
  ON public.huntress_sync_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_sync_results.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

CREATE POLICY "Users can create sync results for their integrations"
  ON public.huntress_sync_results FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.huntress_integrations hi
    WHERE hi.id = huntress_sync_results.huntress_integration_id
    AND hi.created_by_user_id = auth.uid()
  ));

-- Add triggers for updated_at
CREATE TRIGGER update_huntress_integrations_updated_at
  BEFORE UPDATE ON public.huntress_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_huntress_agents_updated_at
  BEFORE UPDATE ON public.huntress_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_huntress_integrations_customer ON public.huntress_integrations(customer_id);
CREATE INDEX idx_huntress_incidents_integration ON public.huntress_incidents(huntress_integration_id);
CREATE INDEX idx_huntress_incidents_severity ON public.huntress_incidents(severity);
CREATE INDEX idx_huntress_agents_integration ON public.huntress_agents(huntress_integration_id);
CREATE INDEX idx_huntress_sync_results_integration ON public.huntress_sync_results(huntress_integration_id);