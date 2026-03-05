
-- Create NIS2 plans table
CREATE TABLE public.nis2_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'NIS2 Sikkerhedsplan',
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  parent_plan_id uuid REFERENCES public.nis2_plans(id),
  
  -- Organization info
  responsible_person text,
  responsible_role text,
  responsible_email text,
  responsible_phone text,
  
  -- NIS2 compliance categories stored as JSONB
  categories jsonb DEFAULT '[]'::jsonb,
  
  -- Risk & review
  risk_level text DEFAULT 'medium',
  last_reviewed_at date,
  last_reviewed_by text,
  next_review_at date,
  
  -- Notes
  additional_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nis2_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own NIS2 plans"
  ON public.nis2_plans FOR SELECT
  TO authenticated
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create NIS2 plans"
  ON public.nis2_plans FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own NIS2 plans"
  ON public.nis2_plans FOR UPDATE
  TO authenticated
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own NIS2 plans"
  ON public.nis2_plans FOR DELETE
  TO authenticated
  USING (created_by_user_id = auth.uid());

-- Updated_at trigger
CREATE TRIGGER update_nis2_plans_updated_at
  BEFORE UPDATE ON public.nis2_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
