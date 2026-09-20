import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingRows, StatCard } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { formatPrice } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";

const PERIODS = [
  { id: "today", days: 0 },
  { id: "7", days: 7 },
  { id: "30", days: 30 },
  { id: "all", days: null },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

export function AnalyticsPanel() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const [period, setPeriod] = useState<PeriodId>("30");
  const days = PERIODS.find((p) => p.id === period)!.days;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", business?.id, period],
    enabled: !!business,
    queryFn: async () => {
      const from =
        days === 0
          ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
          : days
            ? new Date(Date.now() - days * 86400000).toISOString()
            : null;

      let apptQuery = supabase
        .from("appointments")
        .select("service_name, price_cents, status, created_at, staff_id")
        .eq("business_id", business!.id)
        .limit(2000);
      if (from) apptQuery = apptQuery.gte("created_at", from);

      let viewQuery = supabase
        .from("page_views")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id);
      if (from) viewQuery = viewQuery.gte("created_at", from);

      const staffQuery = supabase
        .from("staff")
        .select("id, name")
        .eq("business_id", business!.id);

      const [{ data: appts }, { count: views }, { data: staff }] = await Promise.all([
        apptQuery,
        viewQuery,
        staffQuery,
      ]);
      return { appts: appts ?? [], views: views ?? 0, staff: staff ?? [] };
    },
  });

  const rows = data?.appts ?? [];
  const views = data?.views ?? 0;
  const bookings = rows.length;
  const conversion = views > 0 ? Math.min(100, (bookings / views) * 100) : 0;

  const done = rows.filter((r) => r.status === "completed" || r.status === "confirmed");
  const revenue = done.reduce((s, r) => s + r.price_cents, 0);
  const avgTicket = done.length > 0 ? Math.round(revenue / done.length) : 0;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const noShow = rows.filter((r) => r.status === "no_show").length;

  const staffNames = new Map((data?.staff ?? []).map((s) => [s.id, s.name]));
  const byStaff = Object.entries(
    done.reduce<Record<string, { count: number; cents: number }>>((acc, r) => {
      const key = r.staff_id ?? "none";
      const cur = acc[key] ?? { count: 0, cents: 0 };
      cur.count += 1;
      cur.cents += r.price_cents;
      acc[key] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].cents - a[1].cents);
  const staffMax = byStaff[0]?.[1].cents ?? 1;

  const byService = Object.entries(
    done.reduce<Record<string, { count: number; cents: number }>>((acc, r) => {
      const cur = acc[r.service_name] ?? { count: 0, cents: 0 };
      cur.count += 1;
      cur.cents += r.price_cents;
      acc[r.service_name] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].cents - a[1].cents);

  const max = byService[0]?.[1].cents ?? 1;
  const currency = business?.currency ?? "EUR";

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={period === p.id ? "default" : "outline"}
            onClick={() => setPeriod(p.id)}
          >
            {t(`pf.an.period.${p.id}`)}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingRows rows={3} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label={t("pf.an.views")} value={views} />
            <StatCard label={t("pf.an.bookings")} value={bookings} />
            <StatCard label={t("pf.an.conversion")} value={`${conversion.toFixed(1)}%`} />
          </div>

          <section className="surface mt-4 p-5">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{t("pf.an.visitsBooked")}</span>
              <span className="tabular-nums text-muted-foreground">
                {bookings} {t("pf.an.of")} {views}
              </span>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(2, conversion)}%` }}
              />
            </div>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label={t("pf.an.completed")} value={done.length} />
            <StatCard label={t("pf.an.revenue")} value={formatPrice(revenue, currency)} />
            <StatCard label={t("pf.an.avgTicket")} value={formatPrice(avgTicket, currency)} />
            <StatCard label={t("pf.an.cancellations")} value={cancelled} />
            <StatCard label={t("pf.an.noShows")} value={noShow} />
          </div>

          <section className="surface mt-6 p-5">
            <h2 className="text-base font-bold">{t("pf.an.byStaff")}</h2>
            {byStaff.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("pf.an.noData")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {byStaff.map(([id, v]) => (
                  <li key={id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-bold">
                        {staffNames.get(id) ?? t("pf.an.noData")}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {v.count} · {formatPrice(v.cents, currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (v.cents / staffMax) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface mt-6 p-5">
            <h2 className="text-base font-bold">{t("pf.an.topServices")}</h2>
            {byService.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("pf.an.noData")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {byService.slice(0, 8).map(([name, v]) => (
                  <li key={name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-bold">{name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {v.count} · {formatPrice(v.cents, currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (v.cents / max) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
