import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const viewSchema = z.object({
  businessId: z.string().uuid(),
  sessionId: z.string().trim().min(8).max(64),
});

/** Records one page view per browser session for a public booking page. */
export const trackPageView = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => viewSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("page_views")
      .upsert(
        { business_id: data.businessId, session_id: data.sessionId },
        { onConflict: "business_id,session_id", ignoreDuplicates: true },
      );
    return { ok: true as const };
  });
