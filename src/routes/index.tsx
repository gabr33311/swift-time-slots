import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  CalendarCheck,
  Check,
  Clock,
  Lock,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PrefsToggles } from "@/components/prefs-toggles";
import { SycrasLogo } from "@/components/sycras-logo";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SYCRAS — Marcações online para o teu negócio" },
      {
        name: "description",
        content:
          "Cria a tua página de marcações em minutos. Agenda, clientes e lembretes num só sítio, feito para negócios em Portugal.",
      },
      { property: "og:title", content: "SYCRAS — Marcações online para o teu negócio" },
      {
        property: "og:description",
        content:
          "Página de marcações, agenda e clientes num só sítio. Simples, rápido e feito para Portugal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const REGISTER = { mode: "register", next: undefined } as const;
const SIGN_IN = { mode: undefined, next: undefined } as const;

const FEATURES = [
  { icon: Share2, key: "f1" },
  { icon: CalendarCheck, key: "f2" },
  { icon: Users, key: "f3" },
  { icon: Clock, key: "f4" },
  { icon: ShieldCheck, key: "f5" },
  { icon: Sparkles, key: "f6" },
] as const;

const AGENDA = [
  { time: "09:30", name: "Inês Costa", svc: "home.mock.svc1", status: "confirmed" },
  { time: "10:15", name: "Tiago Reis", svc: "home.mock.svc3", status: "confirmed" },
  { time: "11:30", name: "Marta Lopes", svc: "home.mock.svc2", status: "pending" },
  { time: "14:30", name: "Rui Santos", svc: "home.mock.svc1", status: "confirmed" },
] as const;

const SERVICES = [
  { key: "home.mock.svc1", min: 30, price: "12 €" },
  { key: "home.mock.svc2", min: 20, price: "8 €" },
  { key: "home.mock.svc3", min: 45, price: "18 €" },
] as const;

const SLOTS = ["10:00", "10:30", "11:00", "14:30", "15:00", "16:30"];

const PLAN_FEATURES = [
  "sub.feature.bookingPage",
  "sub.feature.calendar",
  "sub.feature.clients",
  "sub.feature.team",
  "sub.feature.analytics",
  "sub.feature.reminders",
] as const;

function Landing() {
  const { t } = usePrefs();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2">
            <SycrasLogo className="size-8" />
            <span className="hidden text-[15px] font-bold tracking-[0.14em] min-[400px]:inline">
              SYCRAS
            </span>
          </span>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex">
            <a href="#funcionalidades" className="transition-colors hover:text-foreground">
              {t("home.nav.features")}
            </a>
            <a href="#precos" className="transition-colors hover:text-foreground">
              {t("home.nav.pricing")}
            </a>
            <a href="#perguntas" className="transition-colors hover:text-foreground">
              {t("home.nav.faq")}
            </a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <PrefsToggles />
            <Link
              to="/auth"
              search={SIGN_IN}
              className="flex h-11 items-center rounded-full px-3 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("home.signin")}
            </Link>
            <Button asChild size="sm">
              <Link to="/auth" search={REGISTER}>
                {t("home.cta.start")}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="animate-enter mx-auto max-w-4xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-24">
          <p className="flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <span aria-hidden className="h-px w-6 bg-border" />
            {t("home.eyebrow")}
            <span aria-hidden className="h-px w-6 bg-border" />
          </p>
          <h1 className="text-balance-tight mt-6 text-[2.5rem] font-bold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            {t("home.title.a")} <span className="text-brand-ink">{t("home.title.em")}</span>{" "}
            {t("home.title.b")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base font-medium leading-relaxed text-muted-foreground sm:text-lg">
            {t("home.subtitle")}
          </p>
          <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Button asChild size="lg" variant="brand">
              <Link to="/auth" search={REGISTER}>
                {t("home.cta.create")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={SIGN_IN}>
                {t("home.cta.have")}
              </Link>
            </Button>
          </div>
          <p className="mt-5 text-[13px] font-semibold text-muted-foreground">
            {t("home.reassure")}
          </p>
        </section>

        {/* Pré-visualização */}
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 sm:pb-28">
          <div className="relative rounded-[2rem] border border-border bg-muted/50 px-4 py-8 sm:px-10 sm:py-12">
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
              <AgendaPreview />
              <BookingPreview />
            </div>
            <FloatCard className="-top-6 left-6 lg:left-10">
              <Check className="size-4" strokeWidth={3} />
              <span>
                <span className="block text-[13px] font-bold">{t("home.float.confirmed")}</span>
                <span className="block text-xs text-muted-foreground">Sex 16 · 14:30</span>
              </span>
            </FloatCard>
            <FloatCard className="-bottom-6 right-6 lg:right-10">
              <Lock className="size-4" strokeWidth={2.5} />
              <span>
                <span className="block text-[13px] font-bold">{t("home.float.blocked")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("home.float.noOverlap")}
                </span>
              </span>
            </FloatCard>
          </div>
        </section>

        {/* Como funciona */}
        <section className="border-y border-border bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionTitle>{t("home.steps.title")}</SectionTitle>
            <ol className="animate-stagger mt-10 grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <li key={n} className="surface p-6">
                  <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                    {n}
                  </span>
                  <h3 className="mt-4 text-base font-bold">{t(`home.steps.${n}.title`)}</h3>
                  <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">
                    {t(`home.steps.${n}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Funcionalidades */}
        <section
          id="funcionalidades"
          className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24"
        >
          <SectionTitle>{t("home.features.title")}</SectionTitle>
          <div className="mt-10 grid overflow-hidden rounded-3xl border border-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.key}
                className="-mb-px -mr-px border-b border-r border-border bg-card p-6 sm:p-8"
              >
                <span className="flex size-10 items-center justify-center rounded-full border border-border">
                  <f.icon className="size-[18px]" strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-base font-bold">{t(`${f.key}.title`)}</h3>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-muted-foreground">
                  {t(`${f.key}.body`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Preços */}
        <section id="precos" className="scroll-mt-20 border-y border-border bg-muted/40">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionTitle sub={t("home.pricing.body")}>{t("home.pricing.title")}</SectionTitle>
            <div className="mx-auto mt-10 max-w-md">
              <PlanCard
                pro
                name="SYCRAS Pro"
                desc={t("home.pricing.desc")}
                price={t("sub.pro.price")}
                suffix={t("sub.price.suffix")}
                badge={t("sub.trialBadge")}
                features={PLAN_FEATURES.map(t)}
              />
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {t("home.pricing.yearly")}
              </p>
            </div>
          </div>
        </section>

        {/* Perguntas */}
        <section
          id="perguntas"
          className="scroll-mt-20 mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24"
        >
          <SectionTitle>{t("home.faq.title")}</SectionTitle>
          <Accordion type="single" collapsible className="mt-8">
            {[1, 2, 3, 4].map((n) => (
              <AccordionItem key={n} value={`q${n}`}>
                <AccordionTrigger className="text-[15px] font-bold hover:no-underline">
                  {t(`home.faq.${n}.q`)}
                </AccordionTrigger>
                <AccordionContent className="font-medium leading-relaxed text-muted-foreground">
                  {t(`home.faq.${n}.a`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Banner final */}
        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="mx-auto max-w-5xl rounded-[2rem] bg-foreground px-6 py-14 text-center text-background sm:py-20">
            <h2 className="text-balance-tight text-3xl font-bold tracking-[-0.035em] sm:text-5xl">
              {t("home.final.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base font-medium opacity-70">
              {t("home.final.body")}
            </p>
            <div className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Link
                to="/auth"
                search={REGISTER}
                className="flex h-12 items-center justify-center rounded-full bg-background px-7 text-base font-bold text-foreground transition-opacity hover:opacity-90"
              >
                {t("home.cta.create")}
              </Link>
              <Link
                to="/auth"
                search={SIGN_IN}
                className="flex h-12 items-center justify-center rounded-full border border-background/25 px-7 text-base font-bold transition-colors hover:bg-background/10"
              >
                {t("home.cta.have")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm font-medium text-muted-foreground sm:flex-row sm:px-6">
          <span className="font-bold tracking-[0.14em] text-foreground">SYCRAS</span>
          <span>{t("home.footer")}</span>
          <span>© {new Date().getFullYear()} SYCRAS</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="text-center">
      <h2 className="text-balance-tight text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
        {children}
      </h2>
      {sub && (
        <p className="mx-auto mt-3 max-w-md text-base font-medium text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

function FloatCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className={cn(
        "surface absolute hidden items-center gap-3 px-4 py-3 md:flex [&>svg]:shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Phone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="mx-auto w-full max-w-[340px] rounded-[2rem] border border-border bg-card p-4 shadow-[var(--shadow-lift)]"
    >
      <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-muted" />
      <p className="px-1 text-sm font-bold">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function AgendaPreview() {
  const { t } = usePrefs();
  return (
    <figure>
      <Phone title={`${t("home.mock.today")} · Sex 16`}>
        <ul className="space-y-2">
          {AGENDA.map((a) => (
            <li
              key={a.time}
              className="flex items-center gap-3 rounded-2xl border border-border p-2.5"
            >
              <span className="w-11 text-xs font-bold tabular-nums">{a.time}</span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/12 text-xs font-bold text-brand-ink">
                {a.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{a.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{t(a.svc)}</span>
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  a.status === "confirmed"
                    ? "bg-st-confirmed/15 text-st-confirmed-fg"
                    : "bg-st-pending/15 text-st-pending-fg",
                )}
              >
                {t(a.status === "confirmed" ? "home.mock.confirmed" : "home.mock.pending")}
              </span>
            </li>
          ))}
        </ul>
      </Phone>
      <figcaption className="mt-4 text-center text-sm font-bold">{t("showcase.agenda")}</figcaption>
    </figure>
  );
}

function BookingPreview() {
  const { t } = usePrefs();
  return (
    <figure>
      <Phone title={t("home.mock.services")}>
        <ul className="space-y-2">
          {SERVICES.map((s, i) => (
            <li
              key={s.key}
              className={cn(
                "flex items-center justify-between rounded-2xl border p-2.5 text-[13px]",
                i === 0 ? "border-brand bg-brand/5" : "border-border",
              )}
            >
              <span className="font-bold">{t(s.key)}</span>
              <span className="text-xs text-muted-foreground">
                {s.min} min · {s.price}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 px-1 text-xs font-bold text-muted-foreground">{t("home.mock.time")}</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {SLOTS.map((s) => (
            <span
              key={s}
              className={cn(
                "rounded-xl border py-1.5 text-center text-xs font-bold tabular-nums",
                s === "14:30" ? "border-brand bg-brand text-brand-foreground" : "border-border",
              )}
            >
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex h-10 items-center justify-center rounded-xl bg-brand text-[13px] font-bold text-brand-foreground">
          {t("home.mock.confirm")}
        </div>
      </Phone>
      <figcaption className="mt-4 text-center text-sm font-bold">
        {t("showcase.booking")}
      </figcaption>
    </figure>
  );
}

function PlanCard({
  name,
  desc,
  price,
  suffix,
  badge,
  features,
  pro,
}: {
  name: string;
  desc: string;
  price: string;
  suffix?: string;
  badge?: string;
  features: string[];
  pro?: boolean;
}) {
  const { t } = usePrefs();
  return (
    <article
      className={cn(
        "surface relative flex flex-col p-6 sm:p-8",
        pro && "border-subscription-accent/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{name}</h3>
        {badge && (
          <span className="rounded-full border border-subscription-accent px-2.5 py-0.5 text-[11px] font-bold text-foreground">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm font-medium text-muted-foreground">{desc}</p>
      <p className="mt-5 text-4xl font-bold tracking-[-0.03em]">
        {price}
        {suffix && (
          <span className="ml-1 text-base font-semibold text-muted-foreground">{suffix}</span>
        )}
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm font-medium">
            <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
            {f}
          </li>
        ))}
      </ul>
      <Button asChild size="lg" variant={pro ? "default" : "outline"} className="mt-7">
        <Link to="/auth" search={REGISTER}>
          {t(pro ? "home.cta.start" : "home.cta.create")}
        </Link>
      </Button>
    </article>
  );
}
