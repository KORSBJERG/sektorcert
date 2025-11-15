-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('IT', 'OT', 'BOTH')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  consultant_name TEXT NOT NULL,
  overall_maturity_score DECIMAL(3,2),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recommendations table (pre-populated with the 25 recommendations)
CREATE TABLE public.recommendations (
  id SERIAL PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE CHECK (number >= 1 AND number <= 25),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  importance_reason TEXT NOT NULL,
  it_recommendations TEXT,
  ot_recommendations TEXT,
  level_1_description TEXT,
  level_2_description TEXT,
  level_3_description TEXT,
  level_4_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Assessment items (scoring for each recommendation)
CREATE TABLE public.assessment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  recommendation_id INTEGER NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  maturity_level INTEGER CHECK (maturity_level >= 0 AND maturity_level <= 4),
  notes TEXT,
  recommended_actions TEXT,
  status TEXT CHECK (status IN ('not_fulfilled', 'partially_fulfilled', 'fulfilled', 'not_applicable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, recommendation_id)
);

-- Assessment item attachments
CREATE TABLE public.assessment_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assessment_item_id UUID NOT NULL REFERENCES public.assessment_items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allowing all authenticated users for now - can be refined based on user roles)
CREATE POLICY "Allow all for authenticated users" ON public.customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.assessments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read for authenticated users" ON public.recommendations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.assessment_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated users" ON public.assessment_attachments FOR ALL USING (auth.role() = 'authenticated');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_assessment_items_updated_at BEFORE UPDATE ON public.assessment_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();