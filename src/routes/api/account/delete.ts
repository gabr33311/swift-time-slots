import { createFileRoute } from "@tanstack/react-router";

// Deletes the signed-in account for good (site and phone app). The Supabase
// session token proves who is asking.
export const Route = createFileRoute("/api/account/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) {
          return Response.json({ ok: false, message: "Sessão expirada." }, { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        if (!auth.user) {
          return Response.json({ ok: false, message: "Sessão expirada." }, { status: 401 });
        }
        const { deleteAccount } = await import("@/lib/account.server");
        return Response.json(await deleteAccount(auth.user.id));
      },
    },
  },
});
