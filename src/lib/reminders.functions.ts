import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { TestReminderResult } from "@/lib/reminders.server";

/** Sends the reminder email to the signed-in owner, with sample data, to see how it looks. */
export const sendTestReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TestReminderResult> => {
    // RLS: only members can read their business.
    const { data: biz, error: bizError } = await context.supabase
      .from("businesses")
      .select("name, address, city, latitude, longitude, brand_color, reminder_message")
      .eq("id", data.businessId)
      .maybeSingle();
    const to = (context.claims as { email?: string }).email;
    if (!biz) {
      console.error("[reminders] test: business not readable", bizError);
      return { ok: false, reason: "failed", detail: bizError?.message ?? "business" };
    }
    if (!to) return { ok: false, reason: "failed", detail: "no email on account" };
    const { sendTestReminderEmail } = await import("@/lib/reminders.server");
    return sendTestReminderEmail(biz, to);
  });
