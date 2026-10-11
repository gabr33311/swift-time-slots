import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { brandColors } from "@/lib/brand";
import { mapsUrl } from "@/lib/maps";
import { renderReminderMessage } from "@/lib/reminder-message";

/** Sends the reminder email to the signed-in owner, with sample data, to see how it looks. */
export const sendTestReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS: only members can read their business.
    const { data: biz } = await context.supabase
      .from("businesses")
      .select("name, address, city, latitude, longitude, brand_color, reminder_message")
      .eq("id", data.businessId)
      .maybeSingle();
    const to = (context.claims as { email?: string }).email;
    if (!biz || !to) return { ok: false as const, reason: "forbidden" as const };
    if (!process.env["RESEND_API_KEY"])
      return { ok: false as const, reason: "not_configured" as const };

    const address = [biz.address, biz.city].filter(Boolean).join(", ");
    const colors = brandColors(biz.brand_color);
    const tomorrow = new Date(Date.now() + 86400000);
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("appointment-reminder", to, {
        templateData: {
          name: "Ana (exemplo)",
          businessName: biz.name,
          serviceName: "Serviço de exemplo",
          date: new Intl.DateTimeFormat("pt-PT", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Europe/Lisbon",
          }).format(tomorrow),
          time: "10:30",
          message: renderReminderMessage(biz.reminder_message, {
            nome: "Ana",
            serviço: "Serviço de exemplo",
            data: new Intl.DateTimeFormat("pt-PT", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Europe/Lisbon",
            }).format(tomorrow),
            hora: "10:30",
            negócio: biz.name,
          }),
          address: address || undefined,
          mapUrl: mapsUrl({ ...biz, address, name: biz.name }) ?? undefined,
          brandColor: colors.brand,
          brandText: colors.foreground,
        },
      });
      return { ok: true as const, to };
    } catch (e) {
      console.error("[reminders] test failed", e);
      return { ok: false as const, reason: "failed" as const };
    }
  });
