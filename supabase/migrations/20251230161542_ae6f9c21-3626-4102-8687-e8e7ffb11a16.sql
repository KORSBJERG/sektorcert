-- Create emergency plans table
CREATE TABLE public.emergency_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  parent_plan_id UUID REFERENCES public.emergency_plans(id),
  
  -- Plan content
  title TEXT NOT NULL DEFAULT 'Beredskabsplan for Cyberkriminalitet',
  it_contact_name TEXT,
  it_contact_company TEXT,
  it_contact_phone TEXT,
  it_contact_email TEXT,
  
  -- Security measures (array of measures)
  security_measures JSONB DEFAULT '[]'::jsonb,
  
  -- Review info
  last_reviewed_at DATE,
  last_reviewed_by TEXT,
  next_review_at DATE,
  
  -- Additional notes
  additional_notes TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.emergency_plans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own emergency plans"
ON public.emergency_plans FOR SELECT
USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create emergency plans"
ON public.emergency_plans FOR INSERT
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own emergency plans"
ON public.emergency_plans FOR UPDATE
USING (created_by_user_id = auth.uid())
WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own emergency plans"
ON public.emergency_plans FOR DELETE
USING (created_by_user_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_emergency_plans_updated_at
BEFORE UPDATE ON public.emergency_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();