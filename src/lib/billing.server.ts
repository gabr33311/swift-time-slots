// Server-only: Stripe client and subscription sync. Never import from the browser.
import Stripe from "stripe";
import { computeAccess, type SubscriptionRow } from "@/lib/subscription";

let stripeClient: Stripe | null = null;

/** Stripe client using fetch, so it also runs on edge/worker hosts. */
export function stripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  stripeClient ??= new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    // Managed Payments (Stripe handles VAT) needs 2025-03-31.basil or later.
    // The period dates moved onto subscription items in that version; periodOf() reads both.
    apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
  });
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
  // An old Stripe subscription ending must not cancel Pro bought in the phone app.
  if (!live) {
    const { data: row } = await db
      .from("subscriptions")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();
    if (row && (row.store ?? "stripe") !== "stripe" && row.status !== "canceled") return;
  }
  const { error } = await db.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan: live ? "pro" : "free",
      status: sub.status,
      store: "stripe",
      store_subscription_id: null,
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

/** The parts of a RevenueCat webhook event that matter here. */
export type StoreEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  store?: string;
  environment?: string;
  period_type?: string;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  original_transaction_id?: string | null;
  transaction_id?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Writes a Google Play / App Store purchase (sent by RevenueCat) onto the
 * business's row. The phone app logs in to RevenueCat with the business id.
 */
export async function syncStoreSubscription(event: StoreEvent): Promise<void> {
  const businessId = [event.app_user_id, event.original_app_user_id].find(
    (id): id is string => !!id && UUID.test(id),
  );
  const store =
    event.store === "PLAY_STORE" ? "play_store" : event.store === "APP_STORE" ? "app_store" : null;
  if (!businessId || !store) {
    console.warn("[billing] store event ignored", event.type, event.app_user_id, event.store);
    return;
  }

  const ACTIVE = [
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "SUBSCRIPTION_EXTENDED",
    // Cancelled but paid until the end of the period: still Pro until EXPIRATION.
    "CANCELLATION",
  ];
  const status =
    event.type === "EXPIRATION"
      ? "canceled"
      : event.type === "BILLING_ISSUE"
        ? "past_due"
        : ACTIVE.includes(event.type)
          ? event.period_type === "TRIAL"
            ? "trialing"
            : "active"
          : null;
  if (!status) return;

  const db = await admin();
  const { data: row } = await db
    .from("subscriptions")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  // A live subscription on the site wins; the store one must not overwrite it.
  if (
    row?.stripe_subscription_id &&
    (row.store ?? "stripe") === "stripe" &&
    ["active", "trialing", "past_due"].includes(row.status)
  ) {
    console.warn("[billing] store event while Stripe is live", businessId, event.type);
    return;
  }

  const ms = (v?: number | null) => (v ? new Date(v).toISOString() : null);
  const { error } = await db.from("subscriptions").upsert(
    {
      business_id: businessId,
      plan: status === "canceled" ? "free" : "pro",
      status,
      store,
      store_subscription_id:
        status === "canceled"
          ? null
          : (event.original_transaction_id ??
            event.transaction_id ??
            row?.store_subscription_id ??
            "store"),
      current_period_start: ms(event.purchased_at_ms) ?? row?.current_period_start ?? null,
      current_period_end: ms(event.expiration_at_ms) ?? row?.current_period_end ?? null,
    },
    { onConflict: "business_id" },
  );
  if (error) throw error;
}
