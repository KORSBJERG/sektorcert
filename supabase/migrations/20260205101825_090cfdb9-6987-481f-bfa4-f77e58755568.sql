-- Allow all authenticated users to view all profiles for consultant selection
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);