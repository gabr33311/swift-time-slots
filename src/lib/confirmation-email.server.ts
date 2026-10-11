// Server-only: the "booking confirmed" email to the client. Never import from the browser.
import { brandColors } from "@/lib/brand";
import { mapsUrl } from "@/lib/maps";

type Row = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  service_name: string;
  starts_at: string;
  businesses: {
    name: string;
    timezone: string;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    brand_color: string;
  } | null;
};

/** Public origin for the links in the email. */
function appOrigin(): string | null {
  const url = process.env["PUBLIC_APP_URL"];
  return url ? url.replace(/\/$/, "") : null;
}

/**
 * Sends the confirmation email for one appointment: date, place (with a map
 * link) and a button to view or cancel. Returns false when it was not sent.
 */
export async function sendConfirmedEmail(appointmentId: string): Promise<boolean> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [{ data }, { data: tokenRow }] = await Promise.all([
    db
      .from("appointments")
      .select(
        "id, customer_name, customer_email, service_name, starts_at, businesses(name, timezone, address, city, latitude, longitude, brand_color)",
      )
      .eq("id", appointmentId)
      .maybeSingle(),
    db.from("booking_tokens").select("token").eq("appointment_id", appointmentId).maybeSingle(),
  ]);
  const appt = data as unknown as Row | null;
  if (!appt?.customer_email) return false;

  const biz = appt.businesses;
  const tz = biz?.timezone || "Europe/Lisbon";
  const d = new Date(appt.starts_at);
  const address = [biz?.address, biz?.city].filter(Boolean).join(", ");
  const colors = brandColors(biz?.brand_color);
  const origin = appOrigin();

  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const res = await sendTemplateEmail("appointment-confirmed", appt.customer_email, {
      templateData: {
        name: appt.customer_name,
        businessName: biz?.name,
        serviceName: appt.service_name,
        date: new Intl.DateTimeFormat("pt-PT", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: tz,
        }).format(d),
        time: new Intl.DateTimeFormat("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: tz,
        }).format(d),
        address: address || undefined,
        mapUrl: mapsUrl({ ...biz, address, name: biz?.name ?? null }) ?? undefined,
        manageUrl: origin && tokenRow ? `${origin}/booking/${tokenRow.token}` : undefined,
        brandColor: colors.brand,
        brandText: colors.foreground,
      },
      idempotencyKey: `appointment-confirmed-${appt.id}`,
    });
    return res.sent;
  } catch (e) {
    console.error("[confirmation-email] send failed", e);
    return false;
  }
}
