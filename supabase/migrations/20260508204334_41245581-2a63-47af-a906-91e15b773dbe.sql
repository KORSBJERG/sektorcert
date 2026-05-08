GRANT EXECUTE ON FUNCTION public.user_has_customer_access(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;