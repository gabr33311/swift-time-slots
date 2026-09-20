import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { displayCustomerName, formatPrice } from "@/lib/format";
import { PendingCapsule } from "@/components/pending-sheet";
import { Sun } from "lucide-react";
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
  ends_at?: string | null;

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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

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

  // Live cockpit — only meaningful while looking at today.
  const liveToday = isToday
    ? appts.filter((a) => !["cancelled", "no_show", "expired"].includes(a.status))
    : [];
  const ongoing = liveToday.find((a) => {
    const s = new Date(a.starts_at).getTime();
    const e = a.ends_at ? new Date(a.ends_at).getTime() : s + 3_600_000;
    return s <= now && now < e && a.status !== "completed";
  });
  const nextUp = liveToday.find(
    (a) => new Date(a.starts_at).getTime() > now && a.status !== "completed",
  );
  const focusAppt = ongoing ?? nextUp;
  const doneCount = liveToday.filter((a) => a.status === "completed").length;
  const dayRevenue = liveToday.reduce((sum, a) => sum + (a.price_cents ?? 0), 0);
  const dayProgress = liveToday.length ? Math.round((doneCount / liveToday.length) * 100) : 0;

  function relativeLabel(iso: string): string {
    const diff = Math.round((new Date(iso).getTime() - now) / 60_000);
    if (diff < 0) return t("dash.now.late").replace("{n}", String(Math.abs(diff)));
    if (diff < 60) return t("dash.now.inMin").replace("{n}", String(diff));
    return t("dash.now.inHours")
      .replace("{h}", String(Math.floor(diff / 60)))
      .replace("{m}", String(diff % 60).padStart(2, "0"));
  }


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

  const isEn = t("cal.today") === "Today";
  const locale = isEn ? "en-GB" : "pt-PT";
  const labelDate = new Date(`${date}T12:00:00Z`);
  const dayMonth = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(labelDate);
  const weekdayLong = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: tz,
  }).format(labelDate);
  const rawLabel = isToday ? `${t("cal.today")}, ${dayMonth}` : `${weekdayLong}, ${dayMonth}`;
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  return (
    <AppShell>
      <PageHeader
        title={t("cal.title")}
        subtitle={t("cal.subtitle")}
        action={
          <div className="flex items-center gap-2">
            <PendingCapsule variant="badge" />
            <Button className="hidden lg:inline-flex" onClick={() => setNewOpen(true)}>
              {t("cal.new")}
            </Button>
          </div>
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
          <p className="min-w-0 flex-1 truncate text-center text-sm font-bold">{label}</p>
          {!isToday && (
            <button
              onClick={() => setDate(todayIn(tz))}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:bg-muted"
            >
              {t("cal.today")}
            </button>
          )}
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

      {isToday && focusAppt && (
        <section className="surface mb-3 flex items-center gap-3 p-4">
          <span
            data-status={focusAppt.status}
            className="appointment-rail h-12 w-1 shrink-0"
            aria-hidden
          />
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/40 text-[13px] font-black tabular-nums text-foreground">
            {formatTime(focusAppt.starts_at, tz)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              {ongoing ? t("dash.now.ongoing") : t("dash.now.next")}
              {ongoing ? "" : ` · ${relativeLabel(focusAppt.starts_at)}`}
            </p>
            <p className="truncate text-[17px] font-bold leading-snug">
              {displayCustomerName(focusAppt.customer_name, null, 1)}
            </p>
            <p className="truncate text-sm leading-snug text-muted-foreground">
              {focusAppt.service_name}
            </p>
          </div>
          <AppointmentActions
            id={focusAppt.id}
            status={focusAppt.status}
            customerName={displayCustomerName(focusAppt.customer_name, null, 1)}
            customerPhone={focusAppt.customer_phone}
            startsAt={focusAppt.starts_at}
            serviceName={focusAppt.service_name}
            timezone={tz}
          />
        </section>
      )}

      {isToday && liveToday.length > 0 && (
        <section className="surface mb-4 flex items-center gap-3 p-4">
          <Sun className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-500"
                style={{ width: `${dayProgress}%` }}
              />
            </div>
            <p className="mt-1.5 truncate text-xs font-semibold text-muted-foreground">
              {t("dash.progress.done")
                .replace("{done}", String(doneCount))
                .replace("{total}", String(liveToday.length))}
            </p>
          </div>
          <p className="shrink-0 text-sm font-black tabular-nums">{formatPrice(dayRevenue)}</p>
        </section>
      )}

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
        <ul className="space-y-2">
          {agendaRows.map((row, i) => (
            <Fragment key={`row-${i}-${row.hour}`}>
              {i === markerIndex && (
                <li aria-hidden className="flex items-center gap-2 py-0.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.1em] text-foreground">
                    {t("cal.now")}
                  </span>
                  <span className="h-px flex-1 bg-foreground/60" />
                  <span className="size-1.5 rounded-full bg-foreground" />
                </li>
              )}
              {row.kind === "free" ? (
              <li className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNewTime(row.hour);
                    setNewOpen(true);
                  }}
                  className="group flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl border border-dashed border-border/70 bg-transparent px-4 py-2.5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40"
                >
                  <span className="w-14 shrink-0 text-sm font-bold tabular-nums text-muted-foreground/70">
                    {row.hour}
                  </span>
                  <span className="flex-1 text-sm font-medium text-muted-foreground/50">
                    {t("cal.slot.free")}
                  </span>
                  <Plus
                    className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
                    strokeWidth={2.6}
                  />
                </button>
                <button
                  onClick={() => blockHour(row.hour)}
                  aria-label={t("cal.block")}
                  title={t("cal.block")}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60 transition-colors hover:border-solid hover:text-foreground"
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
                className="appointment-state surface surface-hover flex items-stretch gap-3 p-3.5"
              >
                <span
                  data-status={row.appt.status}
                  aria-hidden
                  className="appointment-rail w-1 shrink-0 self-stretch"
                />
                <div className="w-[3.25rem] shrink-0 self-center">
                  <p className="text-[17px] font-black leading-none tabular-nums">
                    {formatTime(row.appt.starts_at, tz)}
                  </p>
                  {row.appt.ends_at && (
                    <p className="mt-1.5 text-[11px] font-semibold leading-none tabular-nums text-muted-foreground">
                      {Math.max(
                        0,
                        Math.round(
                          (new Date(row.appt.ends_at).getTime() -
                            new Date(row.appt.starts_at).getTime()) /
                            60000,
                        ),
                      )}{" "}
                      min
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1 self-center">
                  <p className="line-clamp-2 text-[15px] font-bold leading-snug">
                    {displayCustomerName(row.appt.customer_name, null, i + 1)}
                  </p>
                  <p className="truncate text-sm font-normal leading-snug text-muted-foreground">
                    {row.appt.service_name}
                  </p>
                  {row.appt.notes?.trim() && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("cal.note.label")}
                          className="mt-1.5 flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground"
                        >
                          <StickyNote className="size-3 shrink-0" strokeWidth={2.6} />
                          <span className="truncate">{row.appt.notes}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="start" className="w-64 text-sm">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          {t("cal.note.label")}
                        </p>
                        <p className="whitespace-pre-wrap font-medium">{row.appt.notes}</p>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 self-center">
                  <AppointmentActions
                    id={row.appt.id}
                    status={row.appt.status}
                    customerName={displayCustomerName(row.appt.customer_name, null, i + 1)}
                    customerPhone={row.appt.customer_phone}
                    startsAt={row.appt.starts_at}
                    serviceName={row.appt.service_name}
                    timezone={tz}
                  />
                </div>
              </li>
            )}
            </Fragment>

          ))}
        </ul>
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
