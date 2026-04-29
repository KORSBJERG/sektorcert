
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS huntress_organization_id text;

CREATE TABLE IF NOT EXISTS public.huntress_sync_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  sync_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid NOT NULL DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_huntress_sync_customer ON public.huntress_sync_data(customer_id, sync_type, synced_at DESC);

ALTER TABLE public.huntress_sync_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own huntress sync data"
  ON public.huntress_sync_data FOR SELECT
  TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users insert own huntress sync data"
  ON public.huntress_sync_data FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users update own huntress sync data"
  ON public.huntress_sync_data FOR UPDATE
  TO authenticated
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users delete own huntress sync data"
  ON public.huntress_sync_data FOR DELETE
  TO authenticated
  USING (created_by_user_id = auth.uid());
