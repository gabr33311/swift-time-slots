import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Clock3, CreditCard, Loader2, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FormError, PageHeader } from "@/components/ui-bits";
import { useMyBusiness } from "@/hooks/use-business";
import { useSubscription } from "@/hooks/use-subscription";
import { openBillingPortal, startCheckout } from "@/lib/billing.functions";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/plans")({
  validateSearch: z.object({ checkout: z.enum(["success", "cancelled"]).optional() }),
  head: () => ({
    meta: [
      { title: "Subscrição — SYCRAS" },
      { name: "description", content: "O plano SYCRAS Pro: experiência grátis e subscrição." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlansPage,
});

const FEATURES = [
  "sub.feature.bookingPage",
  "sub.feature.calendar",
  "sub.feature.clients",
  "sub.feature.team",
  "sub.feature.analytics",
  "sub.feature.reminders",
] as const;

function PlansPage() {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const { checkout } = Route.useSearch();
  const { business } = useMyBusiness();
  const { access } = useSubscription();
  const [annual, setAnnual] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tz = business?.timezone ?? "Europe/Lisbon";

  // Back from Stripe: the webhook may take a few seconds to confirm, so refresh a couple of times.
  useEffect(() => {
    if (checkout !== "success") return;
    toast.success(t("sub.checkout.success"));
    const timers = [2000, 6000, 15000].map((ms) =>
      window.setTimeout(() => void qc.invalidateQueries({ queryKey: ["subscription"] }), ms),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [checkout, qc, t]);

  async function subscribe() {
    if (!business) return;
    setBusy(true);
    setError(null);
    try {
      const res = await startCheckout({
        data: { businessId: business.id, interval: annual ? "year" : "month" },
      });
      if (!res.ok) {
        setError(res.message);
        setBusy(false);
        return;
      }
      window.location.assign(res.url);
    } catch {
      setError(t("sub.err.generic"));
      setBusy(false);
    }
  }

  async function manage() {
    if (!business) return;
    setBusy(true);
    setError(null);
    try {
      const res = await openBillingPortal({ data: { businessId: business.id } });
      if (!res.ok) {
        setError(res.message);
        setBusy(false);
        return;
      }
      window.location.assign(res.url);
    } catch {
      setError(t("sub.err.generic"));
      setBusy(false);
    }
  }

  const subscribed = access?.subscribed ?? false;

  return (
    <AppShell>
      <PageHeader title={t("sub.title")} />

      <div className="mx-auto max-w-xl space-y-4">
        {access && <StatusCard access={access} tz={tz} />}

        <section className="surface overflow-hidden p-0">
          <div className="bg-brand bg-[linear-gradient(135deg,var(--brand),color-mix(in_oklch,var(--brand)_82%,white))] px-6 py-6 text-brand-foreground">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-display text-xl font-bold">
                <Sparkles className="size-5" /> SYCRAS Pro
              </p>
              <span className="rounded-full bg-black/10 px-2.5 py-1 text-xs font-bold">
                {t("sub.trialBadge")}
              </span>
            </div>
            <p className="mt-4 flex items-end gap-1.5">
              <span className="font-display text-5xl font-bold leading-none tabular-nums">
                {annual ? t("sub.pro.priceAnnual") : t("sub.pro.price")}
              </span>
              <span className="pb-1 text-sm font-semibold opacity-80">{t("sub.price.suffix")}</span>
            </p>
            <p className="mt-1 text-sm font-medium opacity-80">
              {annual ? t("sub.billedYearly") : t("sub.billedMonthly")}
            </p>
          </div>

          <div className="space-y-5 p-6">
            <div
              role="group"
              aria-label={t("sub.billing.label")}
              className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
            >
              {[
                [false, t("sub.billing.monthly")],
                [true, t("sub.billing.annual")],
              ].map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={annual === value}
                  onClick={() => setAnnual(value as boolean)}
                  className={cn(
                    "h-10 rounded-full text-sm font-bold transition-all",
                    annual === value
                      ? "bg-card text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label as string}
                  {value === true && (
                    <span className="ml-1.5 rounded-full bg-st-confirmed/15 px-1.5 py-0.5 text-[10px] font-bold text-st-confirmed-fg">
                      -20%
                    </span>
                  )}
                </button>
              ))}
            </div>

            <ul className="space-y-2.5">
              {FEATURES.map((key) => (
                <li key={key} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-ink">
                    <Check className="size-3" strokeWidth={3.5} />
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>

            <FormError message={error} />

            {subscribed ? (
              <Button size="lg" className="w-full" onClick={() => void manage()} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <CreditCard />}
                {t("sub.manage")}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="brand"
                className="w-full"
                onClick={() => void subscribe()}
                disabled={busy || !business}
              >
                {busy && <Loader2 className="animate-spin" />}
                {access?.state === "trial" ? t("sub.subscribeKeepTrial") : t("sub.subscribe")}
              </Button>
            )}

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" /> {t("sub.secure")}
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

/** Where the business stands right now, in one line. */
function StatusCard({
  access,
  tz,
}: {
  access: NonNullable<ReturnType<typeof useSubscription>["access"]>;
  tz: string;
}) {
  const { t } = usePrefs();
  const date = (d: Date | null) => (d ? formatDateLong(d.toISOString(), tz) : "");
  const { icon, title, body, tone } =
    access.state === "active"
      ? {
          icon: <ShieldCheck className="size-5" />,
          title: t("sub.status.active"),
          body: access.periodEnd
            ? t("sub.status.renews").replace("{date}", date(access.periodEnd))
            : "",
          tone: "ok" as const,
        }
      : access.state === "past_due"
        ? {
            icon: <CreditCard className="size-5" />,
            title: t("sub.status.pastDue"),
            body: t("sub.status.pastDueBody"),
            tone: "bad" as const,
          }
        : access.state === "trial"
          ? {
              icon: <Clock3 className="size-5" />,
              title: t("sub.status.trial").replace("{n}", String(access.trialDaysLeft)),
              body: t("sub.status.trialEnds").replace("{date}", date(access.trialEndsAt)),
              tone: "brand" as const,
            }
          : {
              icon: <Lock className="size-5" />,
              title: t("sub.status.blocked"),
              body: t("sub.status.blockedBody"),
              tone: "bad" as const,
            };
  return (
    <section className="surface flex items-center gap-3.5 p-4">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          tone === "ok" && "bg-st-confirmed/15 text-st-confirmed-fg",
          tone === "bad" && "bg-st-noshow/15 text-st-noshow-fg",
          tone === "brand" && "bg-brand/15 text-brand-ink",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        {body && <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>}
      </div>
    </section>
  );
}
