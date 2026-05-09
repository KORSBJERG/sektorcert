CREATE TABLE public.data_processing_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  parent_agreement_id uuid,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL DEFAULT 'Databehandleraftale',

  controller_name text NOT NULL DEFAULT 'PEAKNET',
  controller_address text NOT NULL DEFAULT 'Asgilhøjevej 59, 8420 Knebel',
  controller_cvr text NOT NULL DEFAULT '19236870',

  processor_name text NOT NULL,
  processor_address text,
  processor_cvr text,

  content text NOT NULL DEFAULT '',

  effective_date date,
  signed_at date,
  signed_by text,
  additional_notes text,

  created_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.data_processing_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own DPAs"
  ON public.data_processing_agreements FOR SELECT
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Linked users view DPAs"
  ON public.data_processing_agreements FOR SELECT TO authenticated
  USING (user_has_customer_access(auth.uid(), customer_id));

CREATE POLICY "Users can create DPAs"
  ON public.data_processing_agreements FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own DPAs"
  ON public.data_processing_agreements FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own DPAs"
  ON public.data_processing_agreements FOR DELETE
  USING (created_by_user_id = auth.uid());

CREATE TRIGGER update_dpa_updated_at
  BEFORE UPDATE ON public.data_processing_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dpa_customer ON public.data_processing_agreements(customer_id);
CREATE INDEX idx_dpa_parent ON public.data_processing_agreements(parent_agreement_id);