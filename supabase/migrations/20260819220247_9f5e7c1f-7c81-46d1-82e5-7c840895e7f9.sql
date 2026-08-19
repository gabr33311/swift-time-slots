
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ENUMS
CREATE TYPE public.member_role AS ENUM ('owner','manager','staff');
CREATE TYPE public.appointment_status AS ENUM ('pending','confirmed','completed','cancelled','no_show','expired');
CREATE TYPE public.plan_tier AS ENUM ('free','pro','business');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- BUSINESSES
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  business_type text NOT NULL DEFAULT 'other',
  description text,
  address text,
  city text,
  phone text,
  email text,
  website text,
  instagram text,
  logo_url text,
  cover_url text,
  brand_color text NOT NULL DEFAULT '#0f766e',
  timezone text NOT NULL DEFAULT 'Europe/Lisbon',
  currency text NOT NULL DEFAULT 'EUR',
  cancellation_hours integer NOT NULL DEFAULT 24,
  slot_interval_minutes integer NOT NULL DEFAULT 15,
  is_published boolean NOT NULL DEFAULT true,
  seo_indexable boolean NOT NULL DEFAULT true,
  onboarding_completed boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX businesses_slug_idx ON public.businesses (slug);

CREATE TABLE public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.member_role NOT NULL DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
CREATE INDEX business_members_user_idx ON public.business_members (user_id);

-- security definer helpers
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.business_role(_business_id uuid)
RETURNS public.member_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_manage_business(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid() AND m.role IN ('owner','manager'));
$$;

CREATE OR REPLACE FUNCTION public.is_business_owner(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_members m WHERE m.business_id = _business_id AND m.user_id = auth.uid() AND m.role = 'owner');
$$;

GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can read published businesses" ON public.businesses FOR SELECT TO anon, authenticated USING (is_published AND deleted_at IS NULL);
CREATE POLICY "members read own business" ON public.businesses FOR SELECT TO authenticated USING (public.is_business_member(id));
CREATE POLICY "authenticated create business" ON public.businesses FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "managers update business" ON public.businesses FOR UPDATE TO authenticated USING (public.can_manage_business(id)) WITH CHECK (public.can_manage_business(id));
CREATE POLICY "owner deletes business" ON public.businesses FOR DELETE TO authenticated USING (public.is_business_owner(id));
CREATE TRIGGER businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read memberships" ON public.business_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_business_member(business_id));
CREATE POLICY "self or owner insert membership" ON public.business_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_business_owner(business_id));
CREATE POLICY "owner updates membership" ON public.business_members FOR UPDATE TO authenticated USING (public.is_business_owner(business_id)) WITH CHECK (public.is_business_owner(business_id));
CREATE POLICY "owner deletes membership" ON public.business_members FOR DELETE TO authenticated USING (public.is_business_owner(business_id));

-- SERVICES
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 30,
  buffer_minutes integer NOT NULL DEFAULT 0,
  category text,
  image_url text,
  requires_confirmation boolean NOT NULL DEFAULT false,
  deposit_cents integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX services_business_idx ON public.services (business_id);
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active services" ON public.services FOR SELECT TO anon, authenticated
  USING (is_active AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_published AND b.deleted_at IS NULL));
CREATE POLICY "members read services" ON public.services FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "managers write services" ON public.services FOR ALL TO authenticated USING (public.can_manage_business(business_id)) WITH CHECK (public.can_manage_business(business_id));
CREATE TRIGGER services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- STAFF
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  specialty text,
  photo_url text,
  color text NOT NULL DEFAULT '#0f766e',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_business_idx ON public.staff (business_id);
GRANT SELECT ON public.staff TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active staff" ON public.staff FOR SELECT TO anon, authenticated
  USING (is_active AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_published AND b.deleted_at IS NULL));
CREATE POLICY "members read staff" ON public.staff FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "managers write staff" ON public.staff FOR ALL TO authenticated USING (public.can_manage_business(business_id)) WITH CHECK (public.can_manage_business(business_id));
CREATE TRIGGER staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.staff_services (
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);
GRANT SELECT ON public.staff_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_services TO authenticated;
GRANT ALL ON public.staff_services TO service_role;
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read staff services" ON public.staff_services FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_published AND b.deleted_at IS NULL));
CREATE POLICY "members read staff services" ON public.staff_services FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "managers write staff services" ON public.staff_services FOR ALL TO authenticated USING (public.can_manage_business(business_id)) WITH CHECK (public.can_manage_business(business_id));

-- WORKING HOURS
CREATE TABLE public.working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX working_hours_business_idx ON public.working_hours (business_id);
GRANT SELECT ON public.working_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_hours TO authenticated;
GRANT ALL ON public.working_hours TO service_role;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read working hours" ON public.working_hours FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_published AND b.deleted_at IS NULL));
CREATE POLICY "members read working hours" ON public.working_hours FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "managers write working hours" ON public.working_hours FOR ALL TO authenticated USING (public.can_manage_business(business_id)) WITH CHECK (public.can_manage_business(business_id));

-- BLOCKED TIMES
CREATE TABLE public.blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blocked_times_business_idx ON public.blocked_times (business_id, starts_at);
GRANT SELECT ON public.blocked_times TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_times TO authenticated;
GRANT ALL ON public.blocked_times TO service_role;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read blocked times" ON public.blocked_times FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.is_published AND b.deleted_at IS NULL));
CREATE POLICY "members read blocked times" ON public.blocked_times FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "members write blocked times" ON public.blocked_times FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));

-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  notes text,
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_business_idx ON public.customers (business_id);
CREATE UNIQUE INDEX customers_business_phone_idx ON public.customers (business_id, phone) WHERE phone IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read customers" ON public.customers FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "members write customers" ON public.customers FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE TRIGGER customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  service_name text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  status public.appointment_status NOT NULL DEFAULT 'confirmed',
  notes text,
  source text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_valid CHECK (ends_at > starts_at),
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('pending','confirmed') AND staff_id IS NOT NULL)
);
CREATE INDEX appointments_business_start_idx ON public.appointments (business_id, starts_at);
CREATE INDEX appointments_customer_idx ON public.appointments (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read appointments" ON public.appointments FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "members write appointments" ON public.appointments FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));
CREATE TRIGGER appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.appointment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status public.appointment_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.appointment_status_history TO authenticated;
GRANT ALL ON public.appointment_status_history TO service_role;
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read history" ON public.appointment_status_history FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "members insert history" ON public.appointment_status_history FOR INSERT TO authenticated WITH CHECK (public.is_business_member(business_id));

-- BOOKING TOKENS
CREATE TABLE public.booking_tokens (
  token text PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.booking_tokens TO service_role;
ALTER TABLE public.booking_tokens ENABLE ROW LEVEL SECURITY;

-- WAITLIST
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  date_from date,
  date_to date,
  preference text,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_entries TO authenticated;
GRANT ALL ON public.waitlist_entries TO service_role;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read waitlist" ON public.waitlist_entries FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "members write waitlist" ON public.waitlist_entries FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_business_idx ON public.notifications (business_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read notifications" ON public.notifications FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "members write notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan public.plan_tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read subscription" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE TRIGGER subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- AUDIT + SECURITY LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_label text,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read audit" ON public.audit_logs FOR SELECT TO authenticated USING (business_id IS NOT NULL AND public.is_business_member(business_id));
CREATE POLICY "members insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text,
  identifier text,
  kind text NOT NULL,
  business_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX security_events_lookup_idx ON public.security_events (kind, ip_hash, created_at DESC);
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
