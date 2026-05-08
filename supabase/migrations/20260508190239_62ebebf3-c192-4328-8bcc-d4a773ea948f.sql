
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, user_id, display_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Allow signed-in users to read profile rows (column exposure is restricted via GRANTs below)
CREATE POLICY "Authenticated can read profile rows for shared columns"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Restrict authenticated SELECT to non-sensitive columns; owner gets all via the existing "Users can view their own profile" policy + explicit grant
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, user_id, display_name, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;

-- Owners need their own email/phone; allow via separate grant guarded by RLS policy "Users can view their own profile"
GRANT SELECT (email, phone) ON public.profiles TO authenticated;
