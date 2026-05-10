-- Revoke EXECUTE from trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_customer_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_created_by() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_customer_invitations() FROM PUBLIC, anon, authenticated;