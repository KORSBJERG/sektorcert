-- Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('consultant', 'customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Customer access mapping
CREATE TABLE public.customer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, user_id)
);
ALTER TABLE public.customer_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_customer_access(_user_id uuid, _customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.customer_users WHERE user_id = _user_id AND customer_id = _customer_id);
$$;
REVOKE EXECUTE ON FUNCTION public.user_has_customer_access(uuid, uuid) FROM PUBLIC, anon;

CREATE POLICY "Users view own customer links" ON public.customer_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Consultants manage links for own customers" ON public.customer_users
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_users.customer_id AND c.created_by_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_users.customer_id AND c.created_by_user_id = auth.uid()));

-- Invitations table
CREATE TABLE public.customer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(customer_id, email)
);
ALTER TABLE public.customer_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants manage invites for own customers" ON public.customer_invitations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_invitations.customer_id AND c.created_by_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_invitations.customer_id AND c.created_by_user_id = auth.uid()));

-- Auto-accept invitations on signup
CREATE OR REPLACE FUNCTION public.accept_customer_invitations()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  matched_count int;
BEGIN
  INSERT INTO public.customer_users (customer_id, user_id)
  SELECT customer_id, NEW.id FROM public.customer_invitations
  WHERE lower(email) = lower(NEW.email) AND status = 'pending'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS matched_count = ROW_COUNT;

  UPDATE public.customer_invitations
  SET status = 'accepted', accepted_at = now()
  WHERE lower(email) = lower(NEW.email) AND status = 'pending';

  IF matched_count > 0 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_customer_invitations() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_accept_invites ON auth.users;
CREATE TRIGGER on_auth_user_created_accept_invites
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.accept_customer_invitations();

-- Extend RLS: linked customer users get read access
CREATE POLICY "Linked users view their customer"
  ON public.customers FOR SELECT TO authenticated
  USING (public.user_has_customer_access(auth.uid(), id));

CREATE POLICY "Linked users view completed assessments"
  ON public.assessments FOR SELECT TO authenticated
  USING (status = 'completed' AND public.user_has_customer_access(auth.uid(), customer_id));

CREATE POLICY "Linked users view items of completed assessments"
  ON public.assessment_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_items.assessment_id
      AND a.status = 'completed'
      AND public.user_has_customer_access(auth.uid(), a.customer_id)
  ));

CREATE POLICY "Linked users view security reports"
  ON public.security_reports FOR SELECT TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id));

CREATE POLICY "Linked users view nis2 plans"
  ON public.nis2_plans FOR SELECT TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id));

CREATE POLICY "Linked users view emergency plans"
  ON public.emergency_plans FOR SELECT TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id));

CREATE POLICY "Linked users view maester runs"
  ON public.maester_runs FOR SELECT TO authenticated
  USING (public.user_has_customer_access(auth.uid(), customer_id));