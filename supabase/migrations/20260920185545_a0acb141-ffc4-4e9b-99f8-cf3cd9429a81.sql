GRANT SELECT (id, slug, name, description, business_type, address, city, website, instagram, logo_url, cover_url, brand_color, timezone, currency, cancellation_hours, slot_interval_minutes, is_published, seo_indexable, show_team, show_contacts, booking_horizon_months, created_at) ON public.businesses TO anon;

CREATE POLICY "public can read published businesses"
ON public.businesses
FOR SELECT
TO anon
USING (is_published = true AND deleted_at IS NULL);