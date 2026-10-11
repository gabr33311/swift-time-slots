import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

// Stripe calls this after payments, renewals, failures and cancellations.
// The signature check proves the call really comes from Stripe.
export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        const signature = request.headers.get("stripe-signature");
        if (!secret || !signature) {
          return Response.json({ error: "Not configured" }, { status: 400 });
        }

        const { default: StripeSdk } = await import("stripe");
        const { stripe, syncSubscription } = await import("@/lib/billing.server");
        const body = await request.text();

        let event: Stripe.Event;
        try {
          event = await stripe().webhooks.constructEventAsync(
            body,
            signature,
            secret,
            undefined,
            StripeSdk.createSubtleCryptoProvider(),
          );
        } catch (e) {
          console.error("[stripe webhook] bad signature", e);
          return Response.json({ error: "Invalid signature" }, { status: 400 });
        }

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object;
              if (session.subscription) {
                const id =
                  typeof session.subscription === "string"
                    ? session.subscription
                    : session.subscription.id;
                await syncSubscription(await stripe().subscriptions.retrieve(id));
              }
              break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted":
              await syncSubscription(event.data.object);
              break;
            default:
              break;
          }
        } catch (e) {
          // A 500 makes Stripe retry later, so a temporary failure isn't lost.
          console.error("[stripe webhook] sync failed", e);
          return Response.json({ error: "Sync failed" }, { status: 500 });
        }

        return Response.json({ received: true });
      },
    },
  },
});
