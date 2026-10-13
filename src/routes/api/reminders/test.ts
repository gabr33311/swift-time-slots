import { createFileRoute } from "@tanstack/react-router";

// The native phone app asks for a test reminder email here (it can't call server
// functions). The Supabase session token proves who is asking.
export const Route = createFileRoute("/api/reminders/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        if (!auth.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

        let businessId = "";
        try {
          businessId = String(
            ((await request.json()) as { businessId?: unknown }).businessId ?? "",
          );
        } catch {
          // Checked below.
        }
        const { data: member } = await supabaseAdmin
          .from("business_members")
          .select("user_id")
          .eq("business_id", businessId)
          .eq("user_id", auth.user.id)
          .maybeSingle();
        if (!member) return Response.json({ ok: false, reason: "failed", detail: "member" });

        const { data: biz } = await supabaseAdmin
          .from("businesses")
          .select("name, address, city, latitude, longitude, brand_color, reminder_message")
          .eq("id", businessId)
          .maybeSingle();
        if (!biz) return Response.json({ ok: false, reason: "failed", detail: "business" });

        const { sendTestReminderEmail } = await import("@/lib/reminders.server");
        return Response.json(await sendTestReminderEmail(biz, auth.user.email));
      },
    },
  },
});
