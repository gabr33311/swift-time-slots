import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeAccess, type SubscriptionRow } from "@/lib/subscription";

/** Public origin of this app, for Stripe's return links. */
function appOrigin(): string {
  const configured = process.env["PUBLIC_APP_URL"];
  if (configured) return configured.replace(/\/$/, "");
  const req = getRequest();
  const url = new URL(req.url);
  return url.origin;
}

/** Which server settings are missing for payments (empty when ready). */
function missingBillingConfig(): string[] {
  return [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_MONTHLY",
    "STRIPE_PRICE_YEARLY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ].filter((k) => !process.env[k]);
}

const NOT_CONFIGURED = "Os pagamentos ainda não estão configurados neste servidor.";

/** Only the owner or a manager of the business may manage billing. */
async function billableBusiness(
  context: { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string },
  businessId: string,
) {
  const { data: member } = await context.supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "manager")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: business }, { data: sub }] = await Promise.all([
    supabaseAdmin
      .from("businesses")
      .select("id, name, email, created_at")
      .eq("id", businessId)
      .maybeSingle(),
    supabaseAdmin
      .from("subscriptions")
      .select("plan, status, current_period_end, stripe_subscription_id, stripe_customer_id")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  if (!business) return null;
  return { business, sub, supabaseAdmin };
}

/** Starts Stripe Checkout for SYCRAS Pro and returns the page to send the owner to. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) =>
    z.object({ businessId: z.string().uuid(), interval: z.enum(["month", "year"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const missing = missingBillingConfig();
    if (missing.length) {
      console.error("[billing] missing config:", missing.join(", "));
      return { ok: false as const, message: NOT_CONFIGURED };
    }
    const found = await billableBusiness(context, data.businessId);
    if (!found) return { ok: false as const, message: "Sem permissão para gerir a subscrição." };
    const { stripe, priceId } = await import("@/lib/billing.server");
    const { business, sub, supabaseAdmin } = found;

    try {
      // One Stripe customer per business, created the first time.
      let customerId = sub?.stripe_customer_id ?? null;
      if (!customerId) {
        const customer = await stripe().customers.create({
          name: business.name,
          ...(business.email ? { email: business.email } : {}),
          metadata: { business_id: business.id },
        });
        customerId = customer.id;
        await supabaseAdmin
          .from("subscriptions")
          .upsert(
            { business_id: business.id, stripe_customer_id: customerId },
            { onConflict: "business_id" },
          );
      }

      // Subscribing during the free trial keeps the days left: the first charge
      // happens when the trial would have ended (Stripe needs ≥ 48h ahead).
      const access = computeAccess(business.created_at, (sub ?? null) as SubscriptionRow);
      const trialEnd = Math.floor(access.trialEndsAt.getTime() / 1000);
      const keepTrial = access.state === "trial" && trialEnd - Date.now() / 1000 > 48 * 3600;

      const origin = appOrigin();
      const session = await stripe().checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: business.id,
        line_items: [{ price: priceId(data.interval), quantity: 1 }],
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { business_id: business.id },
          ...(keepTrial ? { trial_end: trialEnd } : {}),
        },
        metadata: { business_id: business.id },
        locale: "pt",
        success_url: `${origin}/plans?checkout=success`,
        cancel_url: `${origin}/plans?checkout=cancelled`,
      });
      if (!session.url) return { ok: false as const, message: "O Stripe não devolveu um link." };
      return { ok: true as const, url: session.url };
    } catch (e) {
      console.error("[billing] checkout failed", e);
      return {
        ok: false as const,
        message: "Não foi possível abrir o pagamento. Tenta novamente.",
      };
    }
  });

/** Opens Stripe's billing portal (card, invoices, cancel). */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const missing = missingBillingConfig();
    if (missing.length) {
      console.error("[billing] missing config:", missing.join(", "));
      return { ok: false as const, message: NOT_CONFIGURED };
    }
    const found = await billableBusiness(context, data.businessId);
    if (!found) return { ok: false as const, message: "Sem permissão para gerir a subscrição." };
    const customerId = found.sub?.stripe_customer_id;
    if (!customerId) return { ok: false as const, message: "Ainda não há subscrição para gerir." };
    try {
      const { stripe } = await import("@/lib/billing.server");
      const session = await stripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appOrigin()}/plans`,
        locale: "pt",
      });
      return { ok: true as const, url: session.url };
    } catch (e) {
      console.error("[billing] portal failed", e);
      return { ok: false as const, message: "Não foi possível abrir a gestão da subscrição." };
    }
  });
