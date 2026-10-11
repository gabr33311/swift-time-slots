import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sends a test notification to the phones of this business (members only). */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("business_members")
      .select("user_id")
      .eq("business_id", data.businessId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!member) return { sent: 0 };
    const { pushToBusiness } = await import("@/lib/push.server");
    const sent = await pushToBusiness(data.businessId, {
      title: "SYCRAS",
      body: "As notificações estão a funcionar. Vais saber de cada marcação nova.",
    });
    return { sent };
  });
