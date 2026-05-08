
-- Remove overly broad SELECT policy that exposes email/phone of all users
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Provide a safe minimal view for consultant/user picker scenarios
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT id, user_id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
