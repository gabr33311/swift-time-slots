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
    const { sendConfirmedEmail } = await import("@/lib/confirmation-email.server");
    const sent = await sendConfirmedEmail({
      ...appt,
      businessName: biz?.name,
      timezone: biz?.timezone,
    });
    return { status: sent ? ("sent" as const) : ("failed" as const) };
  });
