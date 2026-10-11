import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Emails the client that their appointment was confirmed. Caller must manage the business (RLS). */
export const sendAppointmentConfirmedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ appointmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: appt } = await context.supabase
      .from("appointments")
      .select(
        "id, status, customer_name, customer_email, service_name, starts_at, businesses(name, timezone)",
      )
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appt || appt.status !== "confirmed") return { status: "failed" as const };
    if (!appt.customer_email) return { status: "no_email" as const };

    const biz = appt.businesses as unknown as { name: string; timezone: string } | null;
    const tz = biz?.timezone ?? "Europe/Lisbon";
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
          businessName: biz?.name,
          serviceName: appt.service_name,
          date,
          time,
        },
        idempotencyKey: `appointment-confirmed-${appt.id}`,
      });
      return { status: res.sent ? ("sent" as const) : ("failed" as const) };
    } catch (e) {
      console.error("[confirmation-email] send failed", e);
      return { status: "failed" as const };
    }
  });
