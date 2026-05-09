-- Add user_agent column
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent text;

-- Update existing trigger to capture IP + user-agent from PostgREST request headers
CREATE OR REPLACE FUNCTION public.log_customer_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  changed_fields TEXT[];
  headers jsonb;
  client_ip text;
  client_ua text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    changed_fields := ARRAY(
      SELECT key FROM jsonb_each(to_jsonb(NEW))
      WHERE to_jsonb(NEW)->>key IS DISTINCT FROM to_jsonb(OLD)->>key
    );
  END IF;

  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers := NULL;
  END;

  client_ip := COALESCE(
    split_part(headers->>'x-forwarded-for', ',', 1),
    headers->>'x-real-ip',
    headers->>'cf-connecting-ip'
  );
  client_ua := headers->>'user-agent';

  INSERT INTO public.audit_logs (
    table_name, record_id, action, user_id, old_data, new_data,
    changed_fields, ip_address, user_agent
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    changed_fields,
    NULLIF(trim(client_ip), ''),
    NULLIF(trim(client_ua), '')
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Update download logger to capture IP + user-agent
CREATE OR REPLACE FUNCTION public.log_document_download(_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc record;
  uid uuid := auth.uid();
  headers jsonb;
  client_ip text;
  client_ua text;
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

  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = doc.customer_id AND c.created_by_user_id = uid
  ) AND NOT public.user_has_customer_access(uid, doc.customer_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers := NULL;
  END;

  client_ip := COALESCE(
    split_part(headers->>'x-forwarded-for', ',', 1),
    headers->>'x-real-ip',
    headers->>'cf-connecting-ip'
  );
  client_ua := headers->>'user-agent';

  INSERT INTO public.audit_logs (
    table_name, record_id, action, user_id, new_data, ip_address, user_agent
  ) VALUES (
    'customer_documents',
    doc.id,
    'DOWNLOAD',
    uid,
    jsonb_build_object(
      'customer_id', doc.customer_id,
      'file_name', doc.file_name,
      'file_path', doc.file_path
    ),
    NULLIF(trim(client_ip), ''),
    NULLIF(trim(client_ua), '')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_document_download(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.log_document_download(uuid) TO authenticated;