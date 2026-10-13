import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public origin of this app, for Stripe's return links. */
function appOrigin(): string {
  const configured = process.env["PUBLIC_APP_URL"];
  if (configured) return configured.replace(/\/$/, "");
  return new URL(getRequest().url).origin;
}

/** Starts Stripe Checkout for SYCRAS Pro and returns the page to send the owner to. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ businessId: z.string().uuid(), interval: z.enum(["month", "year"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createCheckout } = await import("@/lib/billing.server");
    const origin = appOrigin();
    return createCheckout({
      userId: context.userId,
      businessId: data.businessId,
      interval: data.interval,
      successUrl: `${origin}/plans?checkout=success`,
      cancelUrl: `${origin}/plans?checkout=cancelled`,
    });
  });

/** Opens Stripe's billing portal (card, invoices, cancel). */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { createPortal } = await import("@/lib/billing.server");
    return createPortal({
      userId: context.userId,
      businessId: data.businessId,
      returnUrl: `${appOrigin()}/plans`,
    });
  });
