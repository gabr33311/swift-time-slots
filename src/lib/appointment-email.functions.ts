import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends the confirmation email for an appointment the caller manages.
 * RLS restricts the read to business members, so only staff can trigger it.
 */
export const sendConfirmationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ appointmentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: appointment, error } = await context.supabase
      .from("appointments")
      .select("id, status, customer_name, customer_email, service_name, starts_at, business_id")
      .eq("id", data.appointmentId)
      .maybeSingle();

    if (error || !appointment) return { ok: false as const, message: "Marcação não encontrada." };
    if (appointment.status !== "confirmed") {
      return { ok: false as const, message: "A marcação não está confirmada." };
    }
    if (!appointment.customer_email) {
      return { ok: false as const, message: "O cliente não tem email." };
    }

    const { data: business } = await context.supabase
      .from("businesses")
      .select("name, timezone")
      .eq("id", appointment.business_id)
      .maybeSingle();

    const { sendAppointmentConfirmationEmail } = await import("./appointment-email.server");

    return sendAppointmentConfirmationEmail({
      appointmentId: appointment.id,
      to: appointment.customer_email,
      customerName: appointment.customer_name,
      businessName: business?.name ?? "SYCRAS",
      serviceName: appointment.service_name,
      startsAt: appointment.starts_at,
      timezone: business?.timezone ?? "Europe/Lisbon",
    });
  });
