import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const slugSchema = z.object({ slug: z.string().trim().min(1).max(64) });

const slotsSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const bookingSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(24).regex(/^[0-9+\s()-]+$/),
  email: z.string().trim().email().max(160).or(z.literal("")),
  notes: z.string().trim().max(500).optional().default(""),
});

const tokenSchema = z.object({ token: z.string().trim().length(48) });

function clientIp(): string {
  try {
    return (
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      getRequest().headers.get("x-real-ip") ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

export const getPublicBusiness = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const { loadPublicBusiness } = await import("./booking.server");
    return await loadPublicBusiness(data.slug);
  });

export const checkSlugAvailable = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const clean = data.slug.toLowerCase();
    if (!/^[a-z0-9-]{3,48}$/.test(clean)) return { available: false, invalid: true };
    const { slugTaken } = await import("./booking.server");
    return { available: !(await slugTaken(clean)), invalid: false };
  });

export const getAvailableSlots = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => slotsSchema.parse(d))
  .handler(async ({ data }) => {
    const { computeSlots } = await import("./booking.server");
    const slots = await computeSlots(data);
    return slots.map((s) => ({ time: s.time }));
  });

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bookingSchema.parse(d))
  .handler(async ({ data }) => {
    const { computeSlots, makeToken, hashIp, rateLimitExceeded, logSecurityEvent } =
      await import("./booking.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ipHash = await hashIp(clientIp());
    if (await rateLimitExceeded(ipHash, data.phone)) {
      await logSecurityEvent("booking_rate_limited", ipHash, data.phone, data.businessId);
      return {
        ok: false as const,
        code: "rate_limited",
        message: "Demasiadas marcações num curto espaço de tempo. Tenta novamente mais tarde.",
      };
    }

    // Re-validate the slot server-side; never trust the browser.
    const slots = await computeSlots({
      businessId: data.businessId,
      serviceId: data.serviceId,
      staffId: data.staffId,
      date: data.date,
    });
    const slot = slots.find((s) => s.time === data.time);
    if (!slot) {
      return {
        ok: false as const,
        code: "slot_taken",
        message: "Este horário acabou de ser reservado. Escolhe outro horário.",
      };
    }

    const { data: service } = await supabaseAdmin
      .from("services")
      .select("id, name, price_cents, requires_confirmation")
      .eq("id", data.serviceId)
      .eq("business_id", data.businessId)
      .maybeSingle();
    if (!service) return { ok: false as const, code: "invalid", message: "Serviço indisponível." };

    // Find or create the customer for this business only.
    let customerId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("id, is_blocked")
      .eq("business_id", data.businessId)
      .eq("phone", data.phone)
      .maybeSingle();
    if (existing?.is_blocked) {
      await logSecurityEvent("blocked_customer", ipHash, data.phone, data.businessId);
      return {
        ok: false as const,
        code: "blocked",
        message: "Não foi possível concluir a marcação. Contacta directamente o negócio.",
      };
    }
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: created } = await supabaseAdmin
        .from("customers")
        .insert({
          business_id: data.businessId,
          name: data.name,
          phone: data.phone,
          email: data.email || null,
        })
        .select("id")
        .single();
      customerId = created?.id ?? null;
    }

    const status = service.requires_confirmation ? "pending" : "confirmed";
    const { data: appointment, error } = await supabaseAdmin
      .from("appointments")
      .insert({
        business_id: data.businessId,
        service_id: service.id,
        staff_id: slot.staffId,
        customer_id: customerId,
        service_name: service.name,
        customer_name: data.name,
        customer_phone: data.phone,
        customer_email: data.email || null,
        starts_at: slot.startsAt,
        ends_at: slot.endsAt,
        price_cents: service.price_cents,
        status,
        notes: data.notes || null,
        source: "public",
      })
      .select("id, starts_at, ends_at, status")
      .single();

    if (error || !appointment) {
      return {
        ok: false as const,
        code: "slot_taken",
        message: "Este horário acabou de ser reservado. Escolhe outro horário.",
      };
    }

    const token = makeToken();
    await supabaseAdmin.from("booking_tokens").insert({
      token,
      appointment_id: appointment.id,
      expires_at: new Date(new Date(appointment.ends_at).getTime() + 90 * 86400000).toISOString(),
    });

    await supabaseAdmin.from("notifications").insert({
      business_id: data.businessId,
      type: "appointment_created",
      title: "Nova marcação",
      body: `${data.name} — ${service.name}`,
      appointment_id: appointment.id,
    });

    await logSecurityEvent("booking_created", ipHash, data.phone, data.businessId);

    return { ok: true as const, token, status: appointment.status };
  });

export const getBookingByToken = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("booking_tokens")
      .select("appointment_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, service_name, customer_name, starts_at, ends_at, price_cents, status, staff_id, business_id, service_id",
      )
      .eq("id", row.appointment_id)
      .maybeSingle();
    if (!appt) return null;

    const [{ data: business }, { data: staff }] = await Promise.all([
      supabaseAdmin
        .from("businesses")
        .select("name, slug, address, city, phone, timezone, cancellation_hours, brand_color, logo_url")
        .eq("id", appt.business_id)
        .maybeSingle(),
      appt.staff_id
        ? supabaseAdmin.from("staff").select("name").eq("id", appt.staff_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      appointment: {
        id: appt.id,
        service_name: appt.service_name,
        customer_name: appt.customer_name,
        starts_at: appt.starts_at,
        ends_at: appt.ends_at,
        price_cents: appt.price_cents,
        status: appt.status,
        service_id: appt.service_id,
        business_id: appt.business_id,
        staff_id: appt.staff_id,
      },
      staffName: staff?.name ?? null,
      business,
    };
  });

export const cancelBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("booking_tokens")
      .select("appointment_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { ok: false as const, message: "Marcação não encontrada." };

    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, starts_at, business_id, status, customer_name, service_name")
      .eq("id", row.appointment_id)
      .maybeSingle();
    if (!appt) return { ok: false as const, message: "Marcação não encontrada." };
    if (appt.status === "cancelled") return { ok: true as const };

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("cancellation_hours")
      .eq("id", appt.business_id)
      .maybeSingle();
    const limit = (business?.cancellation_hours ?? 24) * 3600000;
    if (new Date(appt.starts_at).getTime() - Date.now() < limit) {
      return {
        ok: false as const,
        message: `O cancelamento online só é possível até ${business?.cancellation_hours ?? 24}h antes. Contacta o negócio.`,
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

export const rescheduleBookingByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    tokenSchema
      .extend({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { computeSlots } = await import("./booking.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("booking_tokens")
      .select("appointment_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { ok: false as const, message: "Marcação não encontrada." };

    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, business_id, service_id, staff_id, status")
      .eq("id", row.appointment_id)
      .maybeSingle();
    if (!appt || !appt.service_id) return { ok: false as const, message: "Marcação não encontrada." };
    if (appt.status === "cancelled")
      return { ok: false as const, message: "Esta marcação está cancelada." };

    const slots = await computeSlots({
      businessId: appt.business_id,
      serviceId: appt.service_id,
      staffId: appt.staff_id,
      date: data.date,
    });
    const slot = slots.find((s) => s.time === data.time);
    if (!slot)
      return {
        ok: false as const,
        message: "Este horário acabou de ser reservado. Escolhe outro horário.",
      };

    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ starts_at: slot.startsAt, ends_at: slot.endsAt, staff_id: slot.staffId })
      .eq("id", appt.id);
    if (error)
      return {
        ok: false as const,
        message: "Este horário acabou de ser reservado. Escolhe outro horário.",
      };

    await supabaseAdmin.from("notifications").insert({
      business_id: appt.business_id,
      type: "appointment_rescheduled",
      title: "Marcação reagendada",
      body: `Nova data: ${data.date} às ${data.time}`,
      appointment_id: appt.id,
    });
    return { ok: true as const };
  });
