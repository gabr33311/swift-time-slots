import { createFileRoute } from "@tanstack/react-router";

// The native phone app asks for a test notification here (it can't call server
// functions). The Supabase session token proves who is asking.
export const Route = createFileRoute("/api/push/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        if (!auth.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

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
        if (!member) return Response.json({ sent: 0 });

        const push = await import("@/lib/push.server");
        const sent = await push.pushToBusiness(businessId, {
          title: "SYCRAS",
          body: "As notificações estão a funcionar. Vais saber de cada marcação nova.",
        });
        return Response.json({ sent, error: push.lastPushError });
      },
    },
  },
});
