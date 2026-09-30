DROP POLICY IF EXISTS "public can read published businesses" ON public.businesses;
CREATE POLICY "public can read published businesses"
ON public.businesses
FOR SELECT
TO anon, authenticated
USING (is_published = true AND deleted_at IS NULL);