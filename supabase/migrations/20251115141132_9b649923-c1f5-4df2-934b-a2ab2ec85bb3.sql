-- Add user ownership tracking to customers and assessments tables
ALTER TABLE public.customers ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.assessments ADD COLUMN created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create function to automatically set created_by on INSERT
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by_user_id = auth.uid();
  RETURN NEW;
END;
$$;

-- Add triggers to auto-populate created_by_user_id
CREATE TRIGGER set_customers_created_by
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by();

CREATE TRIGGER set_assessments_created_by
  BEFORE INSERT ON public.assessments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by();

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.customers;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.assessments;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.assessment_items;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.assessment_attachments;

-- Create user-scoped RLS policies for customers
CREATE POLICY "Users can view their own customers"
  ON public.customers FOR SELECT
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create their own customers"
  ON public.customers FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own customers"
  ON public.customers FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own customers"
  ON public.customers FOR DELETE
  USING (created_by_user_id = auth.uid());

-- Create user-scoped RLS policies for assessments
CREATE POLICY "Users can view assessments for their customers"
  ON public.assessments FOR SELECT
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Users can create assessments for their customers"
  ON public.assessments FOR INSERT
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update their own assessments"
  ON public.assessments FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own assessments"
  ON public.assessments FOR DELETE
  USING (created_by_user_id = auth.uid());

-- Create policies for assessment_items (linked through assessments)
CREATE POLICY "Users can view items for their assessments"
  ON public.assessment_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = assessment_items.assessment_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items for their assessments"
  ON public.assessment_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = assessment_items.assessment_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items for their assessments"
  ON public.assessment_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = assessment_items.assessment_id
      AND assessments.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = assessment_items.assessment_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items for their assessments"
  ON public.assessment_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = assessment_items.assessment_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );

-- Create policies for assessment_attachments (linked through assessment_items)
CREATE POLICY "Users can view attachments for their assessments"
  ON public.assessment_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_items
      JOIN public.assessments ON assessments.id = assessment_items.assessment_id
      WHERE assessment_items.id = assessment_attachments.assessment_item_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create attachments for their assessments"
  ON public.assessment_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessment_items
      JOIN public.assessments ON assessments.id = assessment_items.assessment_id
      WHERE assessment_items.id = assessment_attachments.assessment_item_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update attachments for their assessments"
  ON public.assessment_attachments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_items
      JOIN public.assessments ON assessments.id = assessment_items.assessment_id
      WHERE assessment_items.id = assessment_attachments.assessment_item_id
      AND assessments.created_by_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessment_items
      JOIN public.assessments ON assessments.id = assessment_items.assessment_id
      WHERE assessment_items.id = assessment_attachments.assessment_item_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments for their assessments"
  ON public.assessment_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.assessment_items
      JOIN public.assessments ON assessments.id = assessment_items.assessment_id
      WHERE assessment_items.id = assessment_attachments.assessment_item_id
      AND assessments.created_by_user_id = auth.uid()
    )
  );