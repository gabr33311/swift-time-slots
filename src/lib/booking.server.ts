import { zonedToUtc, weekdayOf, minutesToTime, timeToMinutes, todayIn } from "./time";

export type PublicBusiness = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  business_type: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
  cover_url: string | null;
  brand_color: string;
  timezone: string;
  currency: string;
  cancellation_hours: number;
  slot_interval_minutes: number;
  seo_indexable: boolean;
  show_team: boolean;
  show_contacts: boolean;
  booking_horizon_months: number;
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes: number;
  category: string | null;
  image_url: string | null;
  requires_confirmation: boolean;
};

export type PublicStaff = {
  id: string;
  name: string;
  specialty: string | null;
  photo_url: string | null;
  service_ids: string[];
};

const BUSINESS_FIELDS =
  "id, slug, name, description, business_type, address, city, phone, email, website, instagram, logo_url, cover_url, brand_color, timezone, currency, cancellation_hours, slot_interval_minutes, seo_indexable, show_team, show_contacts, booking_horizon_months";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadPublicBusiness(slug: string): Promise<{
  business: PublicBusiness;
  services: PublicService[];
  staff: PublicStaff[];
} | null> {
  const db = await admin();
  const { data: business } = await db
    .from("businesses")
    .select(BUSINESS_FIELDS)
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!business) return null;

  const [{ data: services }, { data: staff }, { data: links }] = await Promise.all([
    db
      .from("services")
      .select(
        "id, name, description, price_cents, duration_minutes, buffer_minutes, category, image_url, requires_confirmation",
      )
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    db
      .from("staff")
      .select("id, name, specialty, photo_url")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
    db.from("staff_services").select("staff_id, service_id").eq("business_id", business.id),
  ]);

  const [logo_url, cover_url] = await Promise.all([
    signedImage(business.logo_url),
    signedImage(business.cover_url),
  ]);

  return {
    business: { ...business, logo_url, cover_url } as PublicBusiness,
    services: (services ?? []) as PublicService[],
    staff: (staff ?? []).map((s) => ({
      ...s,
      service_ids: (links ?? []).filter((l) => l.staff_id === s.id).map((l) => l.service_id),
    })),
  };
}

/** Storage paths are private; hand the browser a short-lived signed URL. */
async function signedImage(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const db = await admin();
  const { data } = await db.storage.from("business-logos").createSignedUrl(path, 60 * 60 * 12);
  return data?.signedUrl ?? null;
}

export type SlotOption = { time: string; staffId: string; startsAt: string; endsAt: string };

/**
 * Server-side availability. Never trust slots supplied by the browser.
 */
export async function computeSlots(params: {
  businessId: string;
  serviceId: string;
  staffId: string | null;
  date: string;
}): Promise<SlotOption[]> {
  const db = await admin();
  const { data: business } = await db
    .from("businesses")
    .select(
      "id, timezone, slot_interval_minutes, is_published, deleted_at, booking_horizon_months",
    )
    .eq("id", params.businessId)
    .maybeSingle();
  if (!business || !business.is_published || business.deleted_at) return [];

  const { data: service } = await db
    .from("services")
    .select("id, duration_minutes, buffer_minutes, is_active")
    .eq("id", params.serviceId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!service || !service.is_active) return [];

  const tz = business.timezone;
  const today = todayIn(tz);
  if (params.date < today) return [];
  {
    const [y, m, d] = today.split("-").map(Number);
    const limit = new Date(Date.UTC(y!, m! - 1 + (business.booking_horizon_months ?? 2), d!));
    if (params.date > limit.toISOString().slice(0, 10)) return [];
  }

  const { data: allStaff } = await db
    .from("staff")
    .select("id")
    .eq("business_id", business.id)
    .eq("is_active", true);
  const { data: links } = await db
    .from("staff_services")
    .select("staff_id")
    .eq("business_id", business.id)
    .eq("service_id", service.id);

  const linkedIds = (links ?? []).map((l) => l.staff_id);
  let staffIds = (allStaff ?? []).map((s) => s.id);
  if (linkedIds.length > 0) staffIds = staffIds.filter((id) => linkedIds.includes(id));
  if (params.staffId) staffIds = staffIds.filter((id) => id === params.staffId);
  if (staffIds.length === 0) return [];

  const weekday = weekdayOf(params.date);
  const { data: hours } = await db
    .from("working_hours")
    .select("staff_id, start_time, end_time")
    .eq("business_id", business.id)
    .eq("weekday", weekday);

  const dayStart = zonedToUtc(params.date, 0, tz);
  const dayEnd = zonedToUtc(params.date, 24 * 60, tz);

  const [{ data: appointments }, { data: blocks }] = await Promise.all([
    db
      .from("appointments")
      .select("staff_id, starts_at, ends_at")
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
    db
      .from("blocked_times")
      .select("staff_id, starts_at, ends_at")
      .eq("business_id", business.id)
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
  ]);

  const busy = [...(appointments ?? []), ...(blocks ?? [])].map((b) => ({
    staffId: b.staff_id as string | null,
    from: new Date(b.starts_at).getTime(),
    to: new Date(b.ends_at).getTime(),
  }));

  const step = Math.max(5, business.slot_interval_minutes || 15);
  const total = service.duration_minutes + service.buffer_minutes;
  const now = Date.now();
  const leadMs = 30 * 60 * 1000;

  const found = new Map<string, SlotOption>();

  for (const staffId of staffIds) {
    const windows = (hours ?? []).filter((h) => h.staff_id === staffId || h.staff_id === null);
    for (const w of windows) {
      const from = timeToMinutes(w.start_time as unknown as string);
      const to = timeToMinutes(w.end_time as unknown as string);
      for (let m = from; m + total <= to; m += step) {
        const startsAt = zonedToUtc(params.date, m, tz);
        const endsAt = new Date(startsAt.getTime() + total * 60000);
        if (startsAt.getTime() < now + leadMs) continue;
        const clash = busy.some(
          (b) =>
            (b.staffId === null || b.staffId === staffId) &&
            startsAt.getTime() < b.to &&
            endsAt.getTime() > b.from,
        );
        if (clash) continue;
        const label = minutesToTime(m);
        if (!found.has(label)) {
          found.set(label, {
            time: label,
            staffId,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          });
        }
      }
    }
  }

  return [...found.values()].sort((a, b) => a.time.localeCompare(b.time));
}

export function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`marca:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** Simple abuse guard: too many bookings from one IP or phone in a short window. */
export async function rateLimitExceeded(ipHash: string, phone: string | null) {
  const db = await admin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: ipCount } = await db
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "booking_created")
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((ipCount ?? 0) >= 8) return true;
  if (phone) {
    const { count: phoneCount } = await db
      .from("security_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "booking_created")
      .eq("identifier", phone)
      .gte("created_at", since);
    if ((phoneCount ?? 0) >= 4) return true;
  }
  return false;
}

export async function logSecurityEvent(
  kind: string,
  ipHash: string,
  identifier: string | null,
  businessId: string | null,
) {
  const db = await admin();
  await db.from("security_events").insert({
    kind,
    ip_hash: ipHash,
    identifier,
    business_id: businessId,
  });
}

export async function slugTaken(slug: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db.from("businesses").select("id").eq("slug", slug).maybeSingle();
  return !!data;
}

/** Resolves the signed-in client from the request bearer token (null when guest). */
export async function userIdFromAuthHeader(header?: string | null): Promise<string | null> {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const db = await admin();
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}

