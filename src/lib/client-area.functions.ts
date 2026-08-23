import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const idSchema = z.object({ id: z.string().uuid() });

/** Appointments booked by the signed-in client account. */
export const getMyClientAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appts } = await supabaseAdmin
      .from("appointments")
      .select("id, service_name, starts_at, ends_at, price_cents, status, business_id, notes")
      .eq("user_id", context.userId)
      .order("starts_at", { ascending: false })
      .limit(100);

    const ids = [...new Set((appts ?? []).map((a) => a.business_id))];
    const { data: businesses } = ids.length
      ? await supabaseAdmin
          .from("businesses")
          .select("id, name, slug, timezone, currency, address, city, cancellation_hours")
          .in("id", ids)
      : { data: [] };

    const byId = new Map((businesses ?? []).map((b) => [b.id, b]));
    return (appts ?? []).map((a) => ({ ...a, business: byId.get(a.business_id) ?? null }));
  });

export const cancelMyClientAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, starts_at, business_id, status, customer_name, service_name, user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!appt || appt.user_id !== context.userId)
      return { ok: false as const, message: "Marcação não encontrada." };
    if (appt.status === "cancelled") return { ok: true as const };

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("cancellation_hours")
      .eq("id", appt.business_id)
      .maybeSingle();
    const hours = business?.cancellation_hours ?? 24;
    if (new Date(appt.starts_at).getTime() - Date.now() < hours * 3600000) {
      return {
        ok: false as const,
        message: `O cancelamento online só é possível até ${hours}h antes. Contacta o negócio.`,
      };
    }

    await supabaseAdmin.from("appointments").update({ status: "cancelled" }).eq("id", appt.id);
    await supabaseAdmin.from("appointment_status_history").insert({
      appointment_id: appt.id,
      business_id: appt.business_id,
      status: "cancelled",
      note: "Cancelada pelo cliente",
    });
    await supabaseAdmin.from("notifications").insert({
      business_id: appt.business_id,
      type: "appointment_cancelled",
      title: "Marcação cancelada",
      body: `${appt.customer_name} — ${appt.service_name}`,
      appointment_id: appt.id,
    });
    return { ok: true as const };
  });
