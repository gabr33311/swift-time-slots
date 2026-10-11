/**
 * Access rules for the single paid plan (SYCRAS Pro).
 * Every business gets a free trial from the day it is created; after that a
 * live Stripe subscription is required. Shared by the browser and the server.
 */

export const TRIAL_DAYS = 30;

export type SubscriptionRow = {
  plan: "free" | "pro" | "business";
  status: string;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
} | null;

export type AccessState =
  /** Free trial still running. */
  | "trial"
  /** Paying (or in a Stripe trial) — everything works. */
  | "active"
  /** Last payment failed; still works while Stripe retries. */
  | "past_due"
  /** Trial over and no live subscription: the app is locked. */
  | "blocked";

export type Access = {
  state: AccessState;
  /** When the free trial ends (or ended). */
  trialEndsAt: Date;
  /** Whole days left in the free trial (0 when over). */
  trialDaysLeft: number;
  /** Next renewal / end of the paid period, when subscribed. */
  periodEnd: Date | null;
  /** True when the business can use the app and take bookings. */
  allowed: boolean;
  /** True when a Stripe subscription exists (show "Manage" instead of "Subscribe"). */
  subscribed: boolean;
};

const LIVE = new Set(["active", "trialing"]);

export function computeAccess(
  businessCreatedAt: string | Date,
  sub: SubscriptionRow,
  now: Date = new Date(),
): Access {
  const created = new Date(businessCreatedAt);
  const trialEndsAt = new Date(created.getTime() + TRIAL_DAYS * 86_400_000);
  const msLeft = trialEndsAt.getTime() - now.getTime();
  const trialDaysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const isPro = sub?.plan === "pro" || sub?.plan === "business";
  const subscribed = !!sub?.stripe_subscription_id && sub.status !== "canceled";

  let state: AccessState;
  if (isPro && LIVE.has(sub!.status)) state = "active";
  else if (isPro && sub!.status === "past_due") state = "past_due";
  else if (msLeft > 0) state = "trial";
  else state = "blocked";

  return { state, trialEndsAt, trialDaysLeft, periodEnd, allowed: state !== "blocked", subscribed };
}
