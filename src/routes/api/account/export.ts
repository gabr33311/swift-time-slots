import { createFileRoute } from "@tanstack/react-router";

// Sends the signed-in person a copy of their data by email (site and phone app).
// The Supabase session token proves who is asking; it only ever goes to the account's email.
export const Route = createFileRoute("/api/account/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) {
          return Response.json({ ok: false, message: "Sessão expirada." }, { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        if (!auth.user?.email) {
          return Response.json({ ok: false, message: "Sessão expirada." }, { status: 401 });
        }
        const { exportAccount } = await import("@/lib/account.server");
        return Response.json(await exportAccount(auth.user.id, auth.user.email));
      },
    },
  },
});
