-- maester_runs table
CREATE TABLE public.maester_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  created_by_user_id UUID NOT NULL DEFAULT auth.uid(),
  tenant_id TEXT,
  tenant_name TEXT,
  executed_at TIMESTAMPTZ,
  maester_version TEXT,
  pester_version TEXT,
  tests_total INTEGER NOT NULL DEFAULT 0,
  tests_passed INTEGER NOT NULL DEFAULT 0,
  tests_failed INTEGER NOT NULL DEFAULT 0,
  tests_skipped INTEGER NOT NULL DEFAULT 0,
  tests_not_run INTEGER NOT NULL DEFAULT 0,
  pass_percentage NUMERIC,
  severity_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB,
  json_path TEXT,
  result_html_path TEXT,
  nis2_mapping JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maester_runs_customer ON public.maester_runs(customer_id, executed_at DESC);
CREATE INDEX idx_maester_runs_user ON public.maester_runs(created_by_user_id);

ALTER TABLE public.maester_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own maester runs" ON public.maester_runs
  FOR SELECT TO authenticated USING (created_by_user_id = auth.uid());
CREATE POLICY "Users insert own maester runs" ON public.maester_runs
  FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "Users update own maester runs" ON public.maester_runs
  FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid()) WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY "Users delete own maester runs" ON public.maester_runs
  FOR DELETE TO authenticated USING (created_by_user_id = auth.uid());

CREATE TRIGGER update_maester_runs_updated_at
  BEFORE UPDATE ON public.maester_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('maester-reports', 'maester-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: file path layout = <user_id>/<customer_id>/<run_id>/<filename>
CREATE POLICY "Users read own maester files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'maester-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own maester files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'maester-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own maester files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'maester-reports' AND auth.uid()::text = (storage.foldername(name))[1]);