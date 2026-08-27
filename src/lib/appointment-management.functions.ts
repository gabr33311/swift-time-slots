import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const updateBusinessAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appointmentId: z.string().uuid(),
        status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
        note: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: appointment, error: readError } = await context.supabase
      .from("appointments")
      .select("id, business_id, status")
      .eq("id", data.appointmentId)
      .maybeSingle();

    if (readError || !appointment) {
      return { ok: false as const, message: "Marcação não encontrada ou sem permissão." };
    }

    const { error: updateError } = await context.supabase
      .from("appointments")
      .update({ status: data.status })
      .eq("id", appointment.id)
      .eq("business_id", appointment.business_id);

    if (updateError) {
      return { ok: false as const, message: "Não foi possível actualizar a marcação." };
    }

    const { error: historyError } = await context.supabase
      .from("appointment_status_history")
      .insert({
        appointment_id: appointment.id,
        business_id: appointment.business_id,
        status: data.status,
        changed_by: context.userId,
        note: data.note ?? null,
      });

    if (historyError) {
      return { ok: false as const, message: "A marcação mudou, mas o histórico não foi guardado." };
    }

    return { ok: true as const };
  });

export const markBusinessNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ businessId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("business_id", data.businessId)
      .is("read_at", null);

    return error
      ? { ok: false as const, message: "Não foi possível marcar as notificações como lidas." }
      : { ok: true as const };
  });