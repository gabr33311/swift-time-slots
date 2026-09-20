CREATE UNIQUE INDEX IF NOT EXISTS businesses_slug_unique_idx ON public.businesses (slug);

CREATE OR REPLACE FUNCTION public.slug_available(_slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _slug !~ '^[a-z0-9-]{3,48}$' THEN false
    WHEN _slug IN (
      'auth','login','logout','register','reset-password','book','booking','api','app','admin',
      'dashboard','calendar','customers','share','profile','onboarding','analytics','appointments',
      'pendentes','waitlist','booking-page','minhas-marcacoes','settings','support','about','pricing',
      'terms','privacy','assets','static','public','www'
    ) THEN false
    ELSE NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = _slug)
  END
$$;

REVOKE ALL ON FUNCTION public.slug_available(text) FROM public;
GRANT EXECUTE ON FUNCTION public.slug_available(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.email_has_account(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(trim(_email))
      AND deleted_at IS NULL
  )
$$;

REVOKE ALL ON FUNCTION public.email_has_account(text) FROM public;
GRANT EXECUTE ON FUNCTION public.email_has_account(text) TO anon, authenticated, service_role;