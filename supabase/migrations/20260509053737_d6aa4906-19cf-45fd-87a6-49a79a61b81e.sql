-- Reuse existing log_customer_changes trigger function for inserts/updates/deletes
CREATE TRIGGER audit_customer_documents
AFTER INSERT OR UPDATE OR DELETE ON public.customer_documents
FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

-- Secure RPC for client-side download logging
CREATE OR REPLACE FUNCTION public.log_document_download(_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc record;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT d.id, d.customer_id, d.file_name, d.file_path
  INTO doc
  FROM public.customer_documents d
  WHERE d.id = _document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Verify caller has access (consultant owner OR linked customer user)
  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = doc.customer_id AND c.created_by_user_id = uid
  ) AND NOT public.user_has_customer_access(uid, doc.customer_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, user_id, new_data
  ) VALUES (
    'customer_documents',
    doc.id,
    'DOWNLOAD',
    uid,
    jsonb_build_object(
      'customer_id', doc.customer_id,
      'file_name', doc.file_name,
      'file_path', doc.file_path
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_document_download(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_document_download(uuid) TO authenticated;