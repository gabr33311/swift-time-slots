import { createFileRoute } from "@tanstack/react-router";

// The phone app opens the Stripe payment page directly (no site in between).
// The Supabase session token proves who is paying.
export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token)
          return Response.json({ ok: false, message: "Sessão expirada." }, { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        if (!auth.user)
          return Response.json({ ok: false, message: "Sessão expirada." }, { status: 401 });

        let body: { businessId?: string; interval?: string; portal?: boolean } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          // Checked below.
        }
        const businessId = String(body.businessId ?? "");
        // Back to the app: this page sends the browser to sycras://, which closes it.
        const back = `${new URL(request.url).origin}/api/billing/return`;
        const billing = await import("@/lib/billing.server");
        if (body.portal) {
          return Response.json(
            await billing.createPortal({
              userId: auth.user.id,
              businessId,
              returnUrl: `${back}?status=portal`,
            }),
          );
        }
        return Response.json(
          await billing.createCheckout({
            userId: auth.user.id,
            businessId,
            interval: body.interval === "month" ? "month" : "year",
            successUrl: `${back}?status=success`,
            cancelUrl: `${back}?status=cancelled`,
          }),
        );
      },
    },
  },
});
