import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { displayCustomerName } from "@/lib/format";
import { addDays, minutesToTime, timeToMinutes, todayIn, weekdayOf, zonedToUtc } from "@/lib/time";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { ChevronLeft, ChevronRight, Lock, Plus, Unlock } from "lucide-react";
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
  staff_id: string | null;
};

type Block = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  staff_id: string | null;
};

type AgendaRow =
  | { kind: "free"; hour: string }
  | { kind: "appt"; appt: Appt; hour: string }
  | { kind: "block"; block: Block; hour: string };

/** Merges the working-hour grid with booked and blocked slots into one chronological list. */
function buildAgenda(hours: string[], appts: Appt[], blocks: Block[], tz: string): AgendaRow[] {
  const rows: AgendaRow[] = [
    ...appts.map((a) => ({ kind: "appt" as const, appt: a, hour: formatTime(a.starts_at, tz) })),
    ...blocks.map((b) => ({ kind: "block" as const, block: b, hour: formatTime(b.starts_at, tz) })),
  ];
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
  const qc = useQueryClient();
  const tz = business?.timezone ?? "Europe/Lisbon";
  const [date, setDate] = useState(todayIn(tz));
  const [newOpen, setNewOpen] = useState(false);
  const [newTime, setNewTime] = useState("09:00");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", business?.id, date],
    enabled: !!business,
    queryFn: async () => {
      const from = zonedToUtc(date, 0, tz).toISOString();
      const to = zonedToUtc(date, 24 * 60, tz).toISOString();
      const [{ data: appts }, { data: staff }, { data: hours }, { data: blocks }] =
        await Promise.all([
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
          supabase
            .from("blocked_times")
            .select("id, starts_at, ends_at, reason, staff_id")
            .eq("business_id", business!.id)
            .gte("starts_at", from)
            .lt("starts_at", to)
            .order("starts_at"),
        ]);
      return {
        appts: appts ?? [],
        staff: staff ?? [],
        blocks: blocks ?? [],
        hours: hoursFromRanges(
          (hours ?? []).map((h) => ({ start: h.start_time, end: h.end_time })),
        ),
      };
    },
  });

  const staffList = data?.staff ?? [];
  const matchesStaff = (id: string | null) =>
    staffFilter === "all" || id === staffFilter || id === null;
  const appts = (data?.appts ?? []).filter((a) => matchesStaff(a.staff_id));
  const blocks = (data?.blocks ?? []).filter((b) => matchesStaff(b.staff_id));
  const agendaRows = data ? buildAgenda(data.hours, appts, blocks, tz) : [];
  const isToday = date === todayIn(tz);
  const nowHHMM = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date());
  const markerIndex = isToday ? agendaRows.findIndex((r) => r.hour > nowHHMM) : -1;

  const weekStart = addDays(date, -((weekdayOf(date) + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayShort = (d: string) =>
    new Intl.DateTimeFormat(t("cal.today") === "Today" ? "en-GB" : "pt-PT", {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${d}T12:00:00Z`));

  async function blockHour(hour: string) {
    if (!business) return;
    const start = zonedToUtc(date, timeToMinutes(hour), tz);
    const end = zonedToUtc(date, timeToMinutes(hour) + 60, tz);
    const { error } = await supabase.from("blocked_times").insert({
      business_id: business.id,
      staff_id: staffFilter === "all" ? null : staffFilter,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      reason: t("cal.block.reason"),
    });
    if (error) {
      toast.error(t("cal.toast.blockError"));
      return;
    }
    toast.success(t("cal.toast.blocked"));
    qc.invalidateQueries({ queryKey: ["calendar"] });
  }

  async function unblock(id: string) {
    const { error } = await supabase.from("blocked_times").delete().eq("id", id);
    if (error) {
      toast.error(t("cal.toast.blockError"));
      return;
    }
    toast.success(t("cal.toast.unblocked"));
    qc.invalidateQueries({ queryKey: ["calendar"] });
  }

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

      <div className="surface mb-3 p-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(addDays(date, -7))}
            aria-label={t("cal.week.prev")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-bold capitalize">
            {label}
          </p>
          <button
            onClick={() => setDate(addDays(date, 7))}
            aria-label={t("cal.week.next")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {weekDays.map((d) => {
            const active = d === date;
            const isTodayCell = d === todayIn(tz);
            return (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  {dayShort(d).replace(".", "").slice(0, 3)}
                </span>
                <span className="text-sm font-black tabular-nums">{Number(d.slice(8, 10))}</span>
                <span
                  className={cn(
                    "size-1 rounded-full",
                    isTodayCell ? (active ? "bg-background" : "bg-foreground") : "bg-transparent",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>


      {staffList.length > 1 && (
        <div className="mb-4 flex items-center gap-1.5 overflow-x-auto rounded-full bg-muted p-1">
          {[{ id: "all", name: t("cal.staff.all") }, ...staffList].map((s) => (
            <button
              key={s.id}
              onClick={() => setStaffFilter(s.id)}
              className={cn(
                "h-9 shrink-0 rounded-full px-4 text-[13px] font-bold transition-all duration-200",
                staffFilter === s.id
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <LoadingRows rows={5} />
      ) : (data?.hours.length ?? 0) === 0 && appts.length === 0 && blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="flex size-16 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground/70">
            <CalendarOff className="size-7" strokeWidth={2.2} />
          </span>
          <p className="text-sm font-bold text-muted-foreground">{t("cal.freeDay")}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {buildAgenda(data!.hours, appts, blocks, tz).map((row, i) =>
            row.kind === "free" ? (
              <li key={`free-${row.hour}`} className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNewTime(row.hour);
                    setNewOpen(true);
                  }}
                  className="surface surface-hover flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3 text-left"
                >
                  <span className="w-14 shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
                    {row.hour}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-muted-foreground/70">
                    {t("cal.slot.free")}
                  </span>
                  <Plus className="size-4 shrink-0 text-primary" strokeWidth={2.6} />
                </button>
                <button
                  onClick={() => blockHour(row.hour)}
                  aria-label={t("cal.block")}
                  title={t("cal.block")}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Lock className="size-4" strokeWidth={2.6} />
                </button>
              </li>
            ) : row.kind === "block" ? (
              <li
                key={row.block.id}
                className="surface flex items-center gap-3 border-dashed p-4 opacity-80"
              >
                <span className="w-14 shrink-0 text-center text-lg font-black tabular-nums text-muted-foreground">
                  {row.hour}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-snug text-muted-foreground">
                    {t("cal.blocked")}
                  </p>
                  {row.block.reason && (
                    <p className="truncate text-sm leading-snug text-muted-foreground/70">
                      {row.block.reason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => unblock(row.block.id)}
                  aria-label={t("cal.unblock")}
                  title={t("cal.unblock")}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Unlock className="size-4" strokeWidth={2.6} />
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
                <span className="w-14 shrink-0 text-center text-lg font-black tabular-nums">
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
                        data-status={row.appt.status}
                        aria-label={t("cal.note.label")}
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full border border-current bg-card",
                          row.appt.status === "confirmed" && "appointment-status-confirmed",
                          row.appt.status === "pending" && "appointment-status-pending",
                          row.appt.status === "completed" && "appointment-status-completed",
                          ["cancelled", "no_show", "expired"].includes(row.appt.status) && "appointment-status-cancelled",
                        )}
                      >
                        <StickyNote className="size-[18px] text-muted-foreground" strokeWidth={2.6} />
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
