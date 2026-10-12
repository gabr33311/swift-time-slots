import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  ChevronRight,
  Loader2,
  Sparkles,
  UserX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingRows, PageHeader, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { useAppointmentSheet } from "@/lib/appointment-sheet-context";
import { invalidateAppointmentData, setAppointmentStatus } from "@/lib/appointment-status";
import {
  displayCustomerName,
  formatDateLong,
  formatPrice,
  formatTime,
  greetingPt,
} from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { addDays, todayIn, weekdayOf, zonedToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Hoje — SYCRAS" },
      { name: "description", content: "O teu dia: o que vem a seguir e o que precisa de ti." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TodayPage,
});

type Row = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  customer_name: string;
  service_name: string;
  price_cents: number | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";
  staff_id: string | null;
};

const LIVE = ["pending", "confirmed"] as const;
const isLive = (s: Row["status"]) => (LIVE as readonly string[]).includes(s);

function TodayPage() {
  const { t, lang } = usePrefs();
  const { business } = useMyBusiness();
  const { openAppointment } = useAppointmentSheet();
  const tz = business?.timezone ?? "Europe/Lisbon";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["today", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const day = todayIn(tz);
      const weekStart = addDays(day, -((weekdayOf(day) + 6) % 7));
      const fields =
        "id, starts_at, ends_at, customer_name, service_name, price_cents, status, staff_id";
      const results = await Promise.all([
        supabase
          .from("appointments")
          .select(fields)
          .eq("business_id", business!.id)
          .gte("starts_at", zonedToUtc(day, 0, tz).toISOString())
          .lt("starts_at", zonedToUtc(day, 24 * 60, tz).toISOString())
          .order("starts_at"),
        // Requests waiting for an answer, from now on.
        supabase
          .from("appointments")
          .select(fields)
          .eq("business_id", business!.id)
          .eq("status", "pending")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(20),
        // Past appointments nobody closed yet (last 30 days).
        supabase
          .from("appointments")
          .select(fields)
          .eq("business_id", business!.id)
          .in("status", ["pending", "confirmed"])
          .lt("starts_at", new Date().toISOString())
          .gte("starts_at", new Date(Date.now() - 30 * 86400000).toISOString())
          .order("starts_at", { ascending: false })
          .limit(20),
        supabase
          .from("appointments")
          .select("price_cents, status")
          .eq("business_id", business!.id)
          .gte("starts_at", zonedToUtc(weekStart, 0, tz).toISOString())
          .lt("starts_at", zonedToUtc(addDays(weekStart, 7), 0, tz).toISOString()),
      ]);
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
      const [day0, pending, overdue, week] = results;
      return {
        day: (day0.data ?? []) as Row[],
        pending: (pending.data ?? []) as Row[],
        overdue: (overdue.data ?? []) as Row[],
        week: (week.data ?? []) as { price_cents: number | null; status: Row["status"] }[],
      };
    },
  });

  const endOf = (r: Row) =>
    r.ends_at ? new Date(r.ends_at).getTime() : new Date(r.starts_at).getTime() + 3600000;
  const day = data?.day ?? [];
  const liveDay = day.filter((r) => r.status !== "cancelled" && r.status !== "expired");
  const current = liveDay.find(
    (r) => isLive(r.status) && new Date(r.starts_at).getTime() <= now && endOf(r) > now,
  );
  const next = liveDay.find((r) => isLive(r.status) && new Date(r.starts_at).getTime() > now);
  const focus = current ?? next;
  // Overdue = time is over and nobody said how it went (not the one happening now).
  const overdue = (data?.overdue ?? []).filter((r) => endOf(r) <= now);
  const needs = [
    ...(data?.pending ?? []).map((r) => ({ kind: "pending" as const, row: r })),
    ...overdue.map((r) => ({ kind: "overdue" as const, row: r })),
  ];
  const doneCount = liveDay.filter((r) => r.status === "completed").length;
  const expected = liveDay
    .filter((r) => r.status !== "no_show")
    .reduce((s, r) => s + (r.price_cents ?? 0), 0);
  const weekLive = (data?.week ?? []).filter(
    (r) => r.status !== "cancelled" && r.status !== "expired" && r.status !== "no_show",
  );
  const currency = business?.currency ?? "EUR";

  return (
    <AppShell>
      <PageHeader title={greetingPt(new Date(now), lang)} />
      <p className="-mt-2 mb-5 text-sm font-medium text-muted-foreground first-letter:uppercase">
        {formatDateLong(new Date(now).toISOString(), tz)}
      </p>

      {isLoading || !business ? (
        <LoadingRows rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className="animate-stagger mx-auto grid max-w-3xl grid-cols-1 gap-4 [&>*]:min-w-0">
          <div className="space-y-4">
            <FocusCard
              row={focus}
              current={!!current}
              now={now}
              tz={tz}
              hasDay={liveDay.length > 0}
              onOpen={openAppointment}
            />

            <NeedsYou items={needs} tz={tz} onOpen={openAppointment} />

            <DaySummary
              total={liveDay.length}
              done={doneCount}
              money={expected}
              earned={liveDay.length > 0 && doneCount === liveDay.length}
              weekCount={weekLive.length}
              weekMoney={weekLive.reduce((s, r) => s + (r.price_cents ?? 0), 0)}
              currency={currency}
            />

            {day.length > 0 && (
              <section className="surface p-0">
                <div className="flex items-center justify-between px-4 pt-4 pb-1">
                  <h2 className="text-sm font-bold">{t("today.list")}</h2>
                  <Link
                    to="/calendar"
                    className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("today.seeCalendar")} <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <ul className="divide-y divide-border border-t border-border">
                  {day.map((r) => {
                    const past = endOf(r) <= now;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => openAppointment(r.id)}
                          className={cn(
                            "flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40",
                            past && isLive(r.status) === false && "opacity-60",
                          )}
                        >
                          <span className="w-12 shrink-0 font-display text-sm font-bold tabular-nums">
                            {formatTime(r.starts_at, tz)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold">
                              {displayCustomerName(r.customer_name)}
                            </span>
                            <span className="block truncate text-xs font-normal text-muted-foreground">
                              {r.service_name}
                            </span>
                          </span>
                          <StatusBadge status={r.status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

/** The day in numbers: money in big, a progress ring, and the week below. Opens the stats. */
function DaySummary({
  total,
  done,
  money,
  earned,
  weekCount,
  weekMoney,
  currency,
}: {
  total: number;
  done: number;
  money: number;
  earned: boolean;
  weekCount: number;
  weekMoney: number;
  currency: string;
}) {
  const { t } = usePrefs();
  const pct = total ? done / total : 0;
  const r = 26;
  const len = 2 * Math.PI * r;
  return (
    <Link
      to="/analytics"
      className="surface group relative block overflow-hidden p-0 transition-transform active:scale-[0.99]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--brand)_16%,transparent),transparent_60%)]"
      />
      <div className="relative flex items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {t("today.day")}
          </p>
          <p className="mt-1 font-display text-4xl font-bold tabular-nums tracking-tight">
            {formatPrice(money, currency)}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
            {t(earned ? "today.earned" : "today.revenue")} ·{" "}
            {t(total === 1 ? "today.apptsOne" : "today.apptsMany").replace("{n}", String(total))}
          </p>
        </div>
        {/* Done of today's appointments. */}
        <div className="relative size-[68px] shrink-0">
          <svg viewBox="0 0 64 64" className="size-full -rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
            <circle
              cx="32"
              cy="32"
              r={r}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke="var(--brand)"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - pct)}
              className="transition-[stroke-dashoffset] duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-base font-bold tabular-nums leading-none">
              {done}/{total}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">
              {t("today.done")}
            </span>
          </span>
        </div>
      </div>
      <div className="relative flex items-center gap-3 border-t border-border px-5 py-3">
        <BarChart3 className="size-4 shrink-0 text-brand-ink" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {t("today.week")}:{" "}
          <span className="text-muted-foreground">
            {t("today.weekBody")
              .replace("{n}", String(weekCount))
              .replace("{revenue}", formatPrice(weekMoney, currency))}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-xs font-bold text-brand-ink">
          {t("pf.s.analytics")}
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/** The one appointment that matters most right now. */
function FocusCard({
  row,
  current,
  now,
  tz,
  hasDay,
  onOpen,
}: {
  row: Row | undefined;
  current: boolean;
  now: number;
  tz: string;
  hasDay: boolean;
  onOpen: (id: string) => void;
}) {
  const { t } = usePrefs();
  if (!row) {
    return (
      <section className="surface flex items-center gap-4 p-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand/12 dark:bg-brand/25 text-brand-ink">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold leading-tight">
            {hasDay ? t("today.finished") : t("today.empty")}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasDay ? t("today.finishedBody") : t("today.emptyBody")}
          </p>
        </div>
      </section>
    );
  }
  const mins = Math.max(0, Math.round((new Date(row.starts_at).getTime() - now) / 60000));
  const when = current
    ? t("today.now")
    : mins < 60
      ? t("today.inMin").replace("{n}", String(mins))
      : t("today.inH")
          .replace("{h}", String(Math.floor(mins / 60)))
          .replace("{m}", mins % 60 ? String(mins % 60).padStart(2, "0") : "");
  return (
    <button
      type="button"
      onClick={() => onOpen(row.id)}
      // The day's hero: intense blue, white text, a soft glow of the same colour.
      className="relative block w-full overflow-hidden rounded-[var(--radius-2xl)] bg-brand bg-[linear-gradient(140deg,var(--brand),color-mix(in_oklch,var(--brand)_70%,#38a3ff))] p-5 text-left text-brand-foreground transition-transform active:scale-[0.99]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10"
      />
      <div className="relative flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.08em] opacity-80">
          {current ? t("today.now") : t("today.next")}
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur-sm">
          {when}
        </span>
      </div>
      <p className="relative mt-4 font-display text-4xl font-bold tabular-nums leading-none">
        {formatTime(row.starts_at, tz)}
        {row.ends_at && (
          <span className="ml-2 text-lg font-semibold opacity-75">
            – {formatTime(row.ends_at, tz)}
          </span>
        )}
      </p>
      <p className="relative mt-3 truncate text-lg font-bold">
        {displayCustomerName(row.customer_name)}
      </p>
      <p className="relative truncate text-sm opacity-85">{row.service_name}</p>
    </button>
  );
}

/** Requests to answer and past appointments to close, each one tap away. */
function NeedsYou({
  items,
  tz,
  onOpen,
}: {
  items: { kind: "pending" | "overdue"; row: Row }[];
  tz: string;
  onOpen: (id: string) => void;
}) {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const { business } = useMyBusiness();
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: Row["status"]) {
    if (!business || busy) return;
    setBusy(id + status);
    const res = await setAppointmentStatus({ id, businessId: business.id, status });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    if (!res.emailed) toast.success(t("acts.toast.updated"));
    void invalidateAppointmentData(qc);
  }

  if (items.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-border px-4 py-3.5">
        <Check className="size-4 shrink-0 text-muted-foreground" strokeWidth={3} />
        <p className="min-w-0 text-sm">
          <span className="font-bold">{t("today.allClear")}</span>{" "}
          <span className="text-muted-foreground">{t("today.allClearBody")}</span>
        </p>
      </section>
    );
  }

  return (
    <section className="surface p-0">
      <h2 className="flex items-center gap-2 px-4 pt-4 text-sm font-bold">
        <BellRing className="size-4" /> {t("today.needs")}
        <span className="rounded-full bg-brand px-2 py-px text-[11px] font-bold text-brand-foreground">
          {items.length}
        </span>
      </h2>
      <ul className="mt-2 divide-y divide-border">
        {items.map(({ kind, row }) => (
          <li key={kind + row.id} className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              className="min-w-0 flex-1 overflow-hidden text-left"
            >
              <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {kind === "pending" ? t("today.pending") : t("today.overdue")}
              </span>
              <span className="block truncate text-sm font-bold">
                {displayCustomerName(row.customer_name)}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {formatDateLong(row.starts_at, tz)} · {formatTime(row.starts_at, tz)} ·{" "}
                {row.service_name}
              </span>
            </button>
            {kind === "pending" ? (
              <Button
                size="sm"
                onClick={() => void decide(row.id, "confirmed")}
                disabled={!!busy}
                className="h-10"
              >
                {busy === row.id + "confirmed" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Check strokeWidth={3} />
                )}
                {t("acts.confirm")}
              </Button>
            ) : (
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="icon"
                  aria-label={t("sheet.done")}
                  title={t("sheet.done")}
                  onClick={() => void decide(row.id, "completed")}
                  disabled={!!busy}
                  className="size-10"
                >
                  {busy === row.id + "completed" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Check strokeWidth={3} />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={t("sheet.noShow")}
                  title={t("sheet.noShow")}
                  onClick={() => void decide(row.id, "no_show")}
                  disabled={!!busy}
                  className="size-10"
                >
                  <UserX />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
