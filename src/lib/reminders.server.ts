// Server-only: emails clients a reminder before their appointment. Never import from the browser.
import { brandColors } from "@/lib/brand";
import { businessAllowed } from "@/lib/billing.server";

type DueRow = {
  id: string;
  business_id: string;
  customer_name: string;
  customer_email: string | null;
  service_name: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
  businesses: {
    name: string;
    timezone: string;
    address: string | null;
    city: string | null;
    brand_color: string;
    created_at: string;
    reminders_enabled: boolean;
    reminder_hours: number;
  } | null;
};

/** Public origin for the links in the email. */
function appOrigin(): string | null {
  const url = process.env["PUBLIC_APP_URL"];
  return url ? url.replace(/\/$/, "") : null;
}

/**
 * Sends every reminder that is due now. Safe to run often: each appointment
 * gets one email at most (the row in appointment_reminders is claimed first).
 */
export async function sendDueReminders(): Promise<{ sent: number; skipped: number }> {
  // Without an email provider nothing is claimed, so reminders go out once it is set.
  if (!process.env["RESEND_API_KEY"]) return { sent: 0, skipped: 0 };
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

  const now = Date.now();
  // The longest possible lead is 72 h; each business's own setting is checked below.
  const { data, error } = await db
    .from("appointments")
    .select(
      "id, business_id, customer_name, customer_email, service_name, starts_at, ends_at, created_at, businesses!inner(name, timezone, address, city, brand_color, created_at, reminders_enabled, reminder_hours)",
    )
    .eq("status", "confirmed")
    .not("customer_email", "is", null)
    .gt("starts_at", new Date(now + 30 * 60000).toISOString())
    .lte("starts_at", new Date(now + 72 * 3600000).toISOString())
    .eq("businesses.reminders_enabled", true)
    .limit(500);
  if (error) throw error;

  let sent = 0;
  let skipped = 0;
  const allowed = new Map<string, boolean>();

  for (const appt of (data ?? []) as unknown as DueRow[]) {
    const biz = appt.businesses;
    if (!biz || !appt.customer_email) continue;
    const lead = new Date(appt.starts_at).getTime() - now;
    const window = biz.reminder_hours * 3600000;
    if (lead > window) continue;
    // Booked inside the window: the confirmation is still fresh, no reminder needed.
    if (new Date(appt.created_at).getTime() > new Date(appt.starts_at).getTime() - window) continue;

    // Reminders are part of the paid plan (or the trial).
    if (!allowed.has(appt.business_id)) {
      allowed.set(appt.business_id, await businessAllowed(appt.business_id, biz.created_at));
    }
    if (!allowed.get(appt.business_id)) {
      skipped++;
      continue;
    }

    // Claim first: a second run can never send the same reminder twice.
    const { error: claimError } = await db
      .from("appointment_reminders")
      .insert({ appointment_id: appt.id, business_id: appt.business_id, kind: "email" });
    if (claimError) {
      skipped++;
      continue;
    }

    const { data: tokenRow } = await db
      .from("booking_tokens")
      .select("token")
      .eq("appointment_id", appt.id)
      .maybeSingle();
    const origin = appOrigin();
    const tz = biz.timezone || "Europe/Lisbon";
    const d = new Date(appt.starts_at);
    const colors = brandColors(biz.brand_color);

    try {
      const res = await sendTemplateEmail("appointment-reminder", appt.customer_email, {
        templateData: {
          name: appt.customer_name,
          businessName: biz.name,
          serviceName: appt.service_name,
          date: new Intl.DateTimeFormat("pt-PT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: tz,
          }).format(d),
          time: new Intl.DateTimeFormat("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: tz,
          }).format(d),
          address: [biz.address, biz.city].filter(Boolean).join(", ") || undefined,
          manageUrl: origin && tokenRow ? `${origin}/booking/${tokenRow.token}` : undefined,
          brandColor: colors.brand,
          brandText: colors.foreground,
        },
        idempotencyKey: `appointment-reminder-${appt.id}`,
      });
      if (res.sent) sent++;
      else skipped++;
    } catch (e) {
      // Free the claim so the next run tries again.
      await db
        .from("appointment_reminders")
        .delete()
        .eq("appointment_id", appt.id)
        .eq("kind", "email");
      console.error("[reminders] send failed", appt.id, e);
      skipped++;
    }
  }

  return { sent, skipped };
}
