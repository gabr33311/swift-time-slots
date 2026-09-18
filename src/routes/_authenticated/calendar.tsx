import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { displayCustomerName } from "@/lib/format";
import { addDays, minutesToTime, timeToMinutes, todayIn, weekdayOf, zonedToUtc } from "@/lib/time";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "@/components/appointment-actions";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Schedivo" },
      { name: "description", content: "Your team's daily calendar, hour by hour." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});

/** Builds the hour list of a free day from the real working hours ranges. */
function hoursFromRanges(ranges: { start: string; end: string }[]): string[] {
  const out: string[] = [];
  for (const r of ranges) {
    const from = timeToMinutes(r.start.slice(0, 5));
    const to = timeToMinutes(r.end.slice(0, 5));
    for (let m = Math.ceil(from / 60) * 60; m < to; m += 60) out.push(minutesToTime(m));
  }
  return Array.from(new Set(out)).sort();
}

function CalendarPage() {
  const { t } = usePrefs();
  const { business } = useMyBusiness();
  const tz = business?.timezone ?? "Europe/Lisbon";
  const [date, setDate] = useState(todayIn(tz));
  const [newOpen, setNewOpen] = useState(false);
  const [newTime, setNewTime] = useState("09:00");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", business?.id, date],
    enabled: !!business,
    queryFn: async () => {
      const from = zonedToUtc(date, 0, tz).toISOString();
      const to = zonedToUtc(date, 24 * 60, tz).toISOString();
      const [{ data: appts }, { data: staff }, { data: hours }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, starts_at, ends_at, customer_name, customer_phone, service_name, price_cents, status, staff_id")
          .eq("business_id", business!.id)
          .gte("starts_at", from)
          .lt("starts_at", to)
          .order("starts_at"),
        supabase
          .from("staff")
          .select("id, name")
          .eq("business_id", business!.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("working_hours")
          .select("start_time, end_time")
          .eq("business_id", business!.id)
          .eq("weekday", weekdayOf(date))
          .order("start_time"),
      ]);
      return {
        appts: appts ?? [],
        staff: staff ?? [],
        hours: hoursFromRanges(
          (hours ?? []).map((h) => ({ start: h.start_time, end: h.end_time })),
        ),
      };
    },
  });

  const label = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <AppShell>
      <PageHeader
        title={t("cal.title")}
        subtitle={t("cal.subtitle")}
        action={
          <Button className="hidden lg:inline-flex" onClick={() => setNewOpen(true)}>
            {t("cal.new")}
          </Button>
        }
      />

      <div className="surface mb-5 flex items-center gap-1 p-1.5">
        <button
          onClick={() => setDate(addDays(date, -1))}
          aria-label={t("cal.prevDay")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-bold capitalize">{label}</p>
        <button
          onClick={() => setDate(addDays(date, 1))}
          aria-label={t("cal.nextDay")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
        {date === todayIn(tz) && (
          <span className="ml-0.5 flex h-9 shrink-0 items-center rounded-full px-3.5 text-[13px] font-bold text-muted-foreground">
            {t("cal.today")}
          </span>
        )}
      </div>

      {isLoading ? (
        <LoadingRows rows={5} />
      ) : (data?.appts.length ?? 0) === 0 ? (
        <ul className="space-y-2">
          {(data?.hours ?? []).map((h: string) => (
            <li key={h}>
              <button
                onClick={() => {
                  setNewTime(h);
                  setNewOpen(true);
                }}
                className="surface surface-hover flex w-full items-center gap-3.5 px-4 py-3 text-left"
              >
                <span className="w-14 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                  {h}
                </span>
                <span className="flex-1 text-sm font-semibold text-muted-foreground/70">
                  {t("cal.slot.free")}
                </span>
                <Plus className="size-4 shrink-0 text-primary" strokeWidth={2.6} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-6">
          {(data!.staff.length ? data!.staff : [{ id: "none", name: t("cal.unassigned") }]).map((member) => {
            const items = data!.appts.filter((a) =>
              member.id === "none" ? true : a.staff_id === member.id,
            );
            if (items.length === 0) return null;
            return (
              <section key={member.id}>
                <h2 className="font-display mb-2.5 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  {member.name}
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                    {items.length}
                  </span>
                </h2>
                <ul className="space-y-2.5">
                  {items.map((a, i) => (
                    <li
                      key={a.id}
                      data-status={a.status}
                      className={cn("appointment-state surface surface-hover flex items-center gap-3.5 p-4")}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold leading-snug">
                          {displayCustomerName(a.customer_name, null, i + 1)}
                        </p>
                        <p className="truncate text-sm font-normal leading-snug text-muted-foreground">
                          {a.service_name}
                        </p>
                      </div>
                      <AppointmentActions
                        id={a.id}
                        status={a.status}
                        customerName={displayCustomerName(a.customer_name, null, i + 1)}
                        customerPhone={a.customer_phone}
                        startsAt={a.starts_at}
                        serviceName={a.service_name}
                        timezone={tz}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {mounted &&
        createPortal(
          <button
            onClick={() => setNewOpen(true)}
            aria-label={t("cal.new")}
            className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform active:scale-95 lg:hidden"
          >
            <Plus className="size-6" strokeWidth={2.6} />
          </button>,
          document.body,
        )}

      {business && (
        <NewAppointmentDialog
          key={`${date}-${newTime}`}
          business={business}
          open={newOpen}
          onOpenChange={setNewOpen}
          defaultDate={date}
          defaultTime={newTime}
        />
      )}
    </AppShell>
  );
}
