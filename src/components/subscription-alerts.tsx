import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock3, Lock, PauseCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";
import { useSubscription } from "@/hooks/use-subscription";
import { useMyBusiness } from "@/hooks/use-business";

/** Shows a banner only when it matters: trial ending soon, or a failed payment. */
export function SubscriptionBanner() {
  const { t } = usePrefs();
  const { access } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  if (!access || dismissed) return null;

  const trialEnding = access.state === "trial" && access.trialDaysLeft <= 7 && !access.subscribed;
  const failed = access.state === "past_due";
  if (!trialEnding && !failed) return null;

  const isTrial = !failed;
  const Icon = isTrial ? Clock3 : AlertTriangle;
  const text = isTrial
    ? access.trialDaysLeft <= 1
      ? t("sub.alert.trialLastDay")
      : t("sub.alert.trialDays").replace("{n}", String(access.trialDaysLeft))
    : t("sub.alert.payment");

  return (
    <section
      role="status"
      className={cn(
        "animate-enter relative mb-5 flex flex-col gap-3 rounded-2xl border px-4 py-3.5 pr-12 shadow-sm sm:flex-row sm:items-center",
        isTrial ? "border-brand/30 bg-brand/8" : "border-st-noshow/30 bg-st-noshow/8",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            isTrial ? "bg-brand/15 text-brand-ink" : "bg-st-noshow/15 text-st-noshow-fg",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <p className="pt-1.5 text-sm font-semibold leading-snug">{text}</p>
      </div>
      <Button
        asChild
        size="sm"
        variant={isTrial ? "brand" : "default"}
        className="w-full sm:w-auto"
      >
        <Link to="/plans">{t(isTrial ? "sub.alert.subscribe" : "sub.alert.updateCard")}</Link>
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t("nav.close")}
        className="tap-target absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </section>
  );
}

/** Replaces the page when the trial is over and there is no subscription. */
export function Paywall() {
  const { t } = usePrefs();
  return (
    <section className="surface animate-enter mx-auto mt-6 flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand/12 dark:bg-brand/25 text-brand-ink">
        <Lock className="size-6" />
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight">{t("sub.paywall.title")}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">{t("sub.paywall.body")}</p>
      <Button asChild size="lg" variant="brand" className="mt-3 w-full">
        <Link to="/plans">{t("sub.paywall.cta")}</Link>
      </Button>
      <p className="text-xs text-muted-foreground">{t("sub.paywall.safe")}</p>
    </section>
  );
}

/** The owner paused the account: say so on every screen, with the way back. */
export function SuspendedBanner() {
  const { t } = usePrefs();
  const { business } = useMyBusiness();
  if (!business?.suspended_at) return null;
  return (
    <section
      role="status"
      className="animate-enter mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-muted/60 px-4 py-3.5 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground">
          <PauseCircle className="size-[18px]" />
        </span>
        <p className="pt-1.5 text-sm font-semibold leading-snug">{t("acc.suspended.banner")}</p>
      </div>
      <Button asChild size="sm" variant="default" className="w-full sm:w-auto">
        <Link to="/settings">{t("acc.reactivate")}</Link>
      </Button>
    </section>
  );
}
