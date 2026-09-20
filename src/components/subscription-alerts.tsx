import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";

type SubscriptionAlertProps = {
  variant: "trial" | "payment";
  onClose?: () => void;
};

export function SubscriptionAlert({ variant, onClose }: SubscriptionAlertProps) {
  const { t } = usePrefs();
  const isTrial = variant === "trial";
  const Icon = isTrial ? Clock3 : AlertTriangle;

  return (
    <section
      role="alert"
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl border px-4 py-3.5 pr-12 shadow-sm sm:flex-row sm:items-center",
        isTrial
          ? "border-subscription-trial/30 bg-subscription-trial-soft text-subscription-trial-foreground"
          : "border-subscription-danger/30 bg-subscription-danger-soft text-subscription-danger-foreground",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            isTrial
              ? "bg-subscription-trial/15 text-subscription-trial"
              : "bg-subscription-danger/15 text-subscription-danger",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        <p className="pt-1.5 text-sm font-semibold leading-snug">
          {t(isTrial ? "sub.alert.trial" : "sub.alert.payment")}
        </p>
      </div>
      <Button asChild size="sm" variant={isTrial ? "outline" : "destructive"} className="w-full sm:w-auto">
        <Link to="/plans">{t(isTrial ? "sub.alert.viewPlans" : "sub.alert.updateCard")}</Link>
      </Button>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t("nav.close")}
          className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      )}
    </section>
  );
}

export function SubscriptionAlertsPreview() {
  // Both banners are hidden by default during development.
  // Later these will be driven by the database (subscription status).
  const [showTrialWarning, setShowTrialWarning] = useState(false);
  const [showPaymentError, setShowPaymentError] = useState(false);

  if (!showTrialWarning && !showPaymentError) return null;

  return (
    <div className="mb-5 space-y-2.5" aria-label="Subscription alerts preview">
      {showTrialWarning && <SubscriptionAlert variant="trial" onClose={() => setShowTrialWarning(false)} />}
      {showPaymentError && <SubscriptionAlert variant="payment" onClose={() => setShowPaymentError(false)} />}
    </div>
  );
}
