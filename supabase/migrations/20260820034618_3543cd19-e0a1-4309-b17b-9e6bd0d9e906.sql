CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX page_views_business_created_idx ON public.page_views (business_id, created_at DESC);
CREATE UNIQUE INDEX page_views_session_idx ON public.page_views (business_id, session_id);
GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view their page views" ON public.page_views FOR SELECT TO authenticated USING (public.can_manage_business(business_id));

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS show_team boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_contacts boolean NOT NULL DEFAULT true;