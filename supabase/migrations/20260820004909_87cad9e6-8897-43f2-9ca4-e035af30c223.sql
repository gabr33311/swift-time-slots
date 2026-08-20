CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_business_creator(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.created_by = auth.uid());
$$;
REVOKE ALL ON FUNCTION private.is_business_creator(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.is_business_creator(uuid) TO authenticated, service_role;

-- Membership visibility: own rows only (removes recursion for invoker helpers)
DROP POLICY IF EXISTS "members read memberships" ON public.business_members;
CREATE POLICY "members read own membership" ON public.business_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Helper functions become SECURITY INVOKER so they are no longer definer-escalating
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid() AND m.role = 'owner');
$$;

CREATE OR REPLACE FUNCTION public.can_manage_business(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid() AND m.role IN ('owner','manager'));
$$;

CREATE OR REPLACE FUNCTION public.business_role(_business_id uuid)
RETURNS member_role LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT m.role FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid();
$$;

-- Block self-granted owner/manager access
DROP POLICY IF EXISTS "self or owner insert membership" ON public.business_members;
CREATE POLICY "creator or owner insert membership" ON public.business_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'owner' AND private.is_business_creator(business_id))
    OR public.is_business_owner(business_id)
  );