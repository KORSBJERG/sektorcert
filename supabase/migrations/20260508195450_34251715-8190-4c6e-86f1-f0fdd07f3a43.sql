DROP TRIGGER IF EXISTS audit_assessments_changes ON public.assessments;
CREATE TRIGGER audit_assessments_changes
AFTER INSERT OR UPDATE OR DELETE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

DROP TRIGGER IF EXISTS audit_nis2_plans_changes ON public.nis2_plans;
CREATE TRIGGER audit_nis2_plans_changes
AFTER INSERT OR UPDATE OR DELETE ON public.nis2_plans
FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();

DROP TRIGGER IF EXISTS audit_emergency_plans_changes ON public.emergency_plans;
CREATE TRIGGER audit_emergency_plans_changes
AFTER INSERT OR UPDATE OR DELETE ON public.emergency_plans
FOR EACH ROW EXECUTE FUNCTION public.log_customer_changes();