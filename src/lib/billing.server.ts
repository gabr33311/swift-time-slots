// Server-only: Stripe client and subscription sync. Never import from the browser.
import Stripe from "stripe";
import { computeAccess, type SubscriptionRow } from "@/lib/subscription";

let stripeClient: Stripe | null = null;

/** Stripe client using fetch, so it also runs on edge/worker hosts. */
export function stripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  stripeClient ??= new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  return stripeClient;
}

export function priceId(interval: "month" | "year"): string {
  const id =
    interval === "year" ? process.env["STRIPE_PRICE_YEARLY"] : process.env["STRIPE_PRICE_MONTHLY"];
  if (!id) throw new Error(`Missing STRIPE_PRICE_${interval === "year" ? "YEARLY" : "MONTHLY"}`);
  return id;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** The end of the paid period (newer Stripe API versions keep it on the item). */
function periodOf(sub: Stripe.Subscription): { start: number | null; end: number | null } {
  const raw = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
    items?: { data?: { current_period_start?: number; current_period_end?: number }[] };
  };
  const item = raw.items?.data?.[0];
  return {
    start: raw.current_period_start ?? item?.current_period_start ?? null,
    end: raw.current_period_end ?? item?.current_period_end ?? null,
  };
}

/** Writes a Stripe subscription onto the business's row (called from the webhook). */
export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const businessId = sub.metadata?.["business_id"];
  if (!businessId) {
    console.warn("[billing] subscription without business_id metadata", sub.id);
    return;
  }
  const { start, end } = periodOf(sub);
  const live = ["active", "trialing", "past_due"].includes(sub.status);
  const db = await admin();
  const { error } = await db.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan: live ? "pro" : "free",
      status: sub.status,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.status === "canceled" ? null : sub.id,
      current_period_start: start ? new Date(start * 1000).toISOString() : null,
      current_period_end: end ? new Date(end * 1000).toISOString() : null,
    },
    { onConflict: "business_id" },
  );
  if (error) throw error;
}

/**
 * Can this business take online bookings right now? Uses the service key; on
 * hosts without it the check is skipped rather than blocking every business.
 */
export async function businessAllowed(businessId: string, createdAt: string): Promise<boolean> {
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return true;
  const db = await admin();
  const { data } = await db
    .from("subscriptions")
    .select("plan, status, current_period_end, stripe_subscription_id")
    .eq("business_id", businessId)
    .maybeSingle();
  return computeAccess(createdAt, (data ?? null) as SubscriptionRow).allowed;
}
