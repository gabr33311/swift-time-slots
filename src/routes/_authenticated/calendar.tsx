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
import { formatTime } from "@/lib/format";
import { CalendarOff, StickyNote } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Agenda — SYCRAS" },
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

type Appt = {
  id: string;
  starts_at: string;
  customer_name: string;
  customer_phone: string | null;
  service_name: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";
  notes: string | null;
};

type AgendaRow = { kind: "free"; hour: string } | { kind: "appt"; appt: Appt; hour: string };

/** Merges the working-hour grid with booked slots into one chronological list. */
function buildAgenda(hours: string[], appts: Appt[], tz: string): AgendaRow[] {
  const rows: AgendaRow[] = appts.map((a) => ({
    kind: "appt" as const,
    appt: a,
    hour: formatTime(a.starts_at, tz),
  }));
  const takenHours = new Set(rows.map((r) => r.hour.slice(0, 2)));
  for (const h of hours) {
    if (takenHours.has(h.slice(0, 2))) continue;
    rows.push({ kind: "free", hour: h });
  }
  return rows.sort((a, b) => a.hour.localeCompare(b.hour));
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
          .select(
            "id, starts_at, ends_at, customer_name, customer_phone, service_name, price_cents, status, staff_id, notes",
          )
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
      ) : (data?.hours.length ?? 0) === 0 && (data?.appts.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground/70">
            <CalendarOff className="size-7" strokeWidth={2.2} />
          </span>
          <p className="text-sm font-bold text-muted-foreground">{t("cal.freeDay")}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {buildAgenda(data!.hours, data!.appts, tz).map((row, i) =>
            row.kind === "free" ? (
              <li key={`free-${row.hour}`}>
                <button
                  onClick={() => {
                    setNewTime(row.hour);
                    setNewOpen(true);
                  }}
                  className="surface surface-hover flex w-full items-center gap-3.5 px-4 py-3 text-left"
                >
                  <span className="w-14 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                    {row.hour}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-muted-foreground/70">
                    {t("cal.slot.free")}
                  </span>
                  <Plus className="size-4 shrink-0 text-primary" strokeWidth={2.6} />
                </button>
              </li>
            ) : (
              <li
                key={row.appt.id}
                data-status={row.appt.status}
                className={cn(
                  "appointment-state surface surface-hover flex items-center gap-3 p-4",
                )}
              >
                <span className="w-14 shrink-0 text-sm font-bold tabular-nums">
                  {formatTime(row.appt.starts_at, tz)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-snug">
                    {displayCustomerName(row.appt.customer_name, null, i + 1)}
                  </p>
                  <p className="truncate text-sm font-normal leading-snug text-muted-foreground">
                    {row.appt.service_name}
                  </p>
                </div>
                {row.appt.notes?.trim() && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("cal.note.label")}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
                      >
                        <StickyNote className="size-[18px]" strokeWidth={2.6} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-64 text-sm">
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        {t("cal.note.label")}
                      </p>
                      <p className="whitespace-pre-wrap font-medium">{row.appt.notes}</p>
                    </PopoverContent>
                  </Popover>
                )}
                <AppointmentActions
                  id={row.appt.id}
                  status={row.appt.status}
                  customerName={displayCustomerName(row.appt.customer_name, null, i + 1)}
                  customerPhone={row.appt.customer_phone}
                  startsAt={row.appt.starts_at}
                  serviceName={row.appt.service_name}
                  timezone={tz}
                />
              </li>
            ),
          )}
        </ul>
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
