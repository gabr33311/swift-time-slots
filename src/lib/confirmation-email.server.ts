// Server-only: the "booking confirmed" email to the client. Never import from the browser.

type ConfirmedAppointment = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  service_name: string;
  starts_at: string;
  businessName?: string | null | undefined;
  timezone?: string | null | undefined;
};

/** Sends the confirmation email; returns false when it could not be sent. */
export async function sendConfirmedEmail(appt: ConfirmedAppointment): Promise<boolean> {
  if (!appt.customer_email) return false;
  const tz = appt.timezone || "Europe/Lisbon";
  const d = new Date(appt.starts_at);
  const date = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: tz,
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const res = await sendTemplateEmail("appointment-confirmed", appt.customer_email, {
      templateData: {
        name: appt.customer_name,
        businessName: appt.businessName ?? undefined,
        serviceName: appt.service_name,
        date,
        time,
      },
      idempotencyKey: `appointment-confirmed-${appt.id}`,
    });
    return res.sent;
  } catch (e) {
    console.error("[confirmation-email] send failed", e);
    return false;
  }
}
