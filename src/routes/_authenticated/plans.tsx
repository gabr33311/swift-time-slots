import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Crown, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-bits";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({
    meta: [
      { title: "Subscrição e Planos — SYCRAS" },
      { name: "description", content: "Compara os planos Base e Pro da SYCRAS." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Subscrição e Planos — SYCRAS" },
      { property: "og:description", content: "Compara os planos Base e Pro da SYCRAS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

const PLAN_FEATURE_KEYS = {
  base: ["sub.feature.bookingPage", "sub.feature.calendar", "sub.feature.clients"],
  pro: [
    "sub.feature.bookingPage",
    "sub.feature.calendar",
    "sub.feature.clients",
    "sub.feature.analytics",
    "sub.feature.reminders",
    "sub.feature.team",
  ],
} as const;

function PlansPage() {
  const { t } = usePrefs();
  const [annual, setAnnual] = useState(false);

  return (
    <AppShell>
      <PageHeader title={t("sub.title")} />

      <div className="mx-auto max-w-4xl">
        <div className="mb-7 text-center">
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t("sub.intro")}
          </p>
          <div className="mt-5 inline-flex rounded-full border border-border bg-muted p-1" aria-label={t("sub.billing.label")}>
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={cn(
                "h-9 rounded-full px-5 text-sm transition-all",
                !annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {t("sub.billing.monthly")}
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "h-9 rounded-full px-5 text-sm transition-all",
                annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {t("sub.billing.annual")}
              <span className="ml-1.5 text-[10px] font-black text-subscription-accent">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid items-stretch gap-4 md:grid-cols-2">
          <PlanCard
            name={t("sub.base.name")}
            description={t("sub.base.desc")}
            price={t("sub.base.price")}
            suffix={t("sub.price.suffix")}
            featureKeys={PLAN_FEATURE_KEYS.base}
            action={t("sub.base.action")}
            current
          />
          <PlanCard
            name={t("sub.pro.name")}
            description={t("sub.pro.desc")}
            price={annual ? t("sub.pro.priceAnnual") : t("sub.pro.price")}
            suffix={t("sub.price.suffix")}
            featureKeys={PLAN_FEATURE_KEYS.pro}
            action={t("sub.pro.action")}
            featured
          />
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">{t("sub.visualOnly")}</p>
      </div>
    </AppShell>
  );
}

function PlanCard({
  name,
  description,
  price,
  suffix,
  featureKeys,
  action,
  current = false,
  featured = false,
}: {
  name: string;
  description: string;
  price: string;
  suffix: string;
  featureKeys: readonly string[];
  action: string;
  current?: boolean;
  featured?: boolean;
}) {
  const { t } = usePrefs();
  return (
    <article
      className={cn(
        "relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border bg-card p-6",
        featured ? "border-subscription-accent/50 shadow-lift md:-translate-y-2" : "border-border",
      )}
    >
      {featured && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-subscription-accent/40 via-subscription-accent to-subscription-accent/40" />
      )}
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex size-11 items-center justify-center rounded-xl", featured ? "bg-subscription-accent/15 text-subscription-accent" : "bg-muted text-foreground")}>
          {featured ? <Crown className="size-5" /> : <Sparkles className="size-5" />}
        </span>
        <span className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase", featured ? "bg-subscription-accent text-subscription-accent-foreground" : "bg-muted text-muted-foreground")}>
          {t(featured ? "sub.pro.badge" : "sub.current")}
        </span>
      </div>
      <h2 className="mt-5 text-xl font-bold">{name}</h2>
      <p className="mt-1 min-h-10 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-5 flex items-end gap-1">
        <strong className="font-display text-4xl leading-none">{price}</strong>
        <span className="pb-1 text-xs text-muted-foreground">{suffix}</span>
      </div>
      <ul className="mt-6 flex-1 space-y-3">
        {featureKeys.map((key) => (
          <li key={key} className="flex items-start gap-2.5 text-sm">
            <Check className={cn("mt-0.5 size-4 shrink-0", featured ? "text-subscription-accent" : "text-foreground")} />
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
      <Button disabled className="mt-7 w-full" variant={current ? "outline" : "default"}>
        {action}
      </Button>
    </article>
  );
}