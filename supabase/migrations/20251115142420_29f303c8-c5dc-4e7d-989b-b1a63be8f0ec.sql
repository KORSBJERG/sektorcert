-- Create audit_logs table to track all data access and modifications
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  ip_address TEXT
);

-- Add index for faster queries
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only allow users to view their own audit logs
CREATE POLICY "Users can view audit logs for their own actions"
  ON public.audit_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Create function to log customer changes
CREATE OR REPLACE FUNCTION public.log_customer_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_fields TEXT[];
BEGIN
  -- Determine which fields changed for UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    changed_fields := ARRAY(
      SELECT key FROM jsonb_each(to_jsonb(NEW)) 
      WHERE to_jsonb(NEW)->>key IS DISTINCT FROM to_jsonb(OLD)->>key
    );
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    user_id,
    old_data,
    new_data,
    changed_fields
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    changed_fields
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for customers table
CREATE TRIGGER audit_customers_insert
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

CREATE TRIGGER audit_customers_update
  AFTER UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

CREATE TRIGGER audit_customers_delete
  AFTER DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

-- Create triggers for assessments table
CREATE TRIGGER audit_assessments_insert
  AFTER INSERT ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

CREATE TRIGGER audit_assessments_update
  AFTER UPDATE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

CREATE TRIGGER audit_assessments_delete
  AFTER DELETE ON public.assessments
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

-- Create triggers for assessment_items table
CREATE TRIGGER audit_assessment_items_insert
  AFTER INSERT ON public.assessment_items
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

CREATE TRIGGER audit_assessment_items_update
  AFTER UPDATE ON public.assessment_items
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

CREATE TRIGGER audit_assessment_items_delete
  AFTER DELETE ON public.assessment_items
  FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();