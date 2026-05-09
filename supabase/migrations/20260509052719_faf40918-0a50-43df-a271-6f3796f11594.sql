-- Documents table
CREATE TABLE public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_documents_customer ON public.customer_documents(customer_id);
CREATE INDEX idx_customer_documents_category ON public.customer_documents(category);

ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

-- Consultant who owns customer can do everything
CREATE POLICY "Consultants manage own customer documents"
ON public.customer_documents FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.created_by_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_id AND c.created_by_user_id = auth.uid()));

-- Linked customer users can view
CREATE POLICY "Linked users view customer documents"
ON public.customer_documents FOR SELECT TO authenticated
USING (public.user_has_customer_access(auth.uid(), customer_id));

CREATE TRIGGER update_customer_documents_updated_at
BEFORE UPDATE ON public.customer_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-documents', 'customer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path layout = {customer_id}/{filename}
CREATE POLICY "Consultants manage docs in own customer folder"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND c.created_by_user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'customer-documents'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id::text = (storage.foldername(name))[1]
    AND c.created_by_user_id = auth.uid()
  )
);

CREATE POLICY "Linked users view docs in their customer folder"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'customer-documents'
  AND public.user_has_customer_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);