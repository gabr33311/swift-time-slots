import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { displayCustomerName, formatPrice } from "@/lib/format";
import { PendingCapsule } from "@/components/pending-sheet";
import { addDays, minutesToTime, timeToMinutes, todayIn, weekdayOf, zonedToUtc } from "@/lib/time";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { Check, ChevronLeft, ChevronRight, Copy, Lock, Plus, StickyNote, Unlock, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "@/components/appointment-actions";
import { usePrefs } from "@/lib/prefs";
import { formatTime } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setAppointmentStatus } from "@/lib/appointment-status";

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

/** Parses the real working ranges of the day into minutes from midnight. */
function rangesFromRows(rows: { start: string; end: string }[]): { start: number; end: number }[] {
  return rows
    .map((r) => ({ start: timeToMinutes(r.start.slice(0, 5)), end: timeToMinutes(r.end.slice(0, 5)) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
}

/** Compact, language-neutral duration label: 45 min, 1h, 1h30. */
function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}


type Appt = {
  id: string;
  starts_at: string;
  ends_at?: string | null;

  customer_name: string;
  customer_phone: string | null;
  service_name: string;
  price_cents: number | null;
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
  | { kind: "free"; start: number; end: number }
  | { kind: "appt"; appt: Appt; start: number; end: number }
  | { kind: "block"; block: Block; start: number; end: number };

/** Minutes from midnight of an ISO instant, as seen in the business timezone. */
function minuteOfDay(iso: string, tz: string): number {
  return timeToMinutes(formatTime(iso, tz));
}

/**
 * Empty stretches stay compact: short gaps are sliced into bookable steps,
 * long stretches collapse into a single row so the day never turns into an
 * endless list of identical placeholders.
 */
function freeChunks(start: number, end: number, step: number): AgendaRow[] {
  const span = end - start;
  if (span <= 0) return [];
  if (span > step * 3) return [{ kind: "free", start, end }];
  const out: AgendaRow[] = [];
  let cursor = start;
  while (end - cursor > step * 1.5) {
    out.push({ kind: "free", start: cursor, end: cursor + step });
    cursor += step;
  }
  if (end - cursor > 0) out.push({ kind: "free", start: cursor, end });
  return out;
}

/**
 * Dynamic timeline: real appointment/block spans, with the actual empty gaps
 * between them surfaced as bookable slots.
 */
function buildAgenda(
  ranges: { start: number; end: number }[],
  appts: Appt[],
  blocks: Block[],
  tz: string,
  step: number,
): AgendaRow[] {
  const busy: AgendaRow[] = [
    ...appts.map((a) => {
      const start = minuteOfDay(a.starts_at, tz);
      const rawEnd = a.ends_at ? minuteOfDay(a.ends_at, tz) : start + 60;
      return { kind: "appt" as const, appt: a, start, end: rawEnd > start ? rawEnd : start + 60 };
    }),
    ...blocks.map((b) => {
      const start = minuteOfDay(b.starts_at, tz);
      const rawEnd = minuteOfDay(b.ends_at, tz);
      return { kind: "block" as const, block: b, start, end: rawEnd > start ? rawEnd : 24 * 60 };
    }),
  ].sort((a, b) => a.start - b.start);

  const rows: AgendaRow[] = [...busy];
  for (const range of ranges) {
    let cursor = range.start;
    for (const item of busy) {
      if (item.end <= range.start || item.start >= range.end) continue;
      if (item.start > cursor) rows.push(...freeChunks(cursor, Math.min(item.start, range.end), step));
      cursor = Math.max(cursor, item.end);
      if (cursor >= range.end) break;
    }
    if (cursor < range.end) rows.push(...freeChunks(cursor, range.end, step));
  }
  return rows.sort((a, b) => a.start - b.start || a.end - b.end);
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
        ranges: rangesFromRows(
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
  const step = Math.min(60, Math.max(15, business?.slot_interval_minutes ?? 30));
  const agendaRows = data ? buildAgenda(data.ranges, appts, blocks, tz, step) : [];
  const isToday = date === todayIn(tz);
  const nowMinutes = timeToMinutes(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date()),
  );
  const markerIndex = isToday ? agendaRows.findIndex((r) => r.start > nowMinutes) : -1;


  // Live cockpit — only meaningful while looking at today.
  const liveToday = isToday
    ? appts.filter((a) => !["cancelled", "no_show", "expired"].includes(a.status))
    : [];
  const nextUp = liveToday.find(
    (a) => new Date(a.starts_at).getTime() > now && a.status !== "completed",
  );
  const doneCount = liveToday.filter((a) => a.status === "completed").length;
  const dayRevenue = liveToday.reduce((sum, a) => sum + (a.price_cents ?? 0), 0);
  const progressPill = t("cal.progress.pill")
    .replace("{done}", String(doneCount))
    .replace("{total}", String(liveToday.length))
    .replace("{revenue}", formatPrice(dayRevenue));


  const weekStart = addDays(date, -((weekdayOf(date) + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayShort = (d: string) =>
    new Intl.DateTimeFormat(t("cal.today") === "Today" ? "en-GB" : "pt-PT", {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(`${d}T12:00:00Z`));

  async function blockSlot(startMin: number, endMin: number) {
    if (!business) return;
    if (isPastMinute(startMin)) return;
    const start = zonedToUtc(date, startMin, tz);
    const end = zonedToUtc(date, endMin, tz);
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

  function isPastMinute(minute: number) {
    return zonedToUtc(date, minute, tz).getTime() <= now;
  }


  function needsValidation(appt: Appt) {
    if (["completed", "cancelled", "no_show", "expired"].includes(appt.status)) return false;
    const start = new Date(appt.starts_at).getTime();
    const end = appt.ends_at ? new Date(appt.ends_at).getTime() : start + 3_600_000;
    return end <= now;
  }

  async function validateAppointment(id: string, status: "completed" | "no_show") {
    if (!business) return;
    const result = await setAppointmentStatus({
      id,
      businessId: business.id,
      status,
      note: t("acts.note.changed"),
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t("acts.toast.updated"));
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  async function copyPublicLink() {
    if (!business) return;
    try {
      await navigator.clipboard.writeText(`https://sycras.com/${business.slug}`);
      toast.success(t("cal.empty.copyDone"));
    } catch (error) {
      console.error("Could not copy booking link", error);
      toast.error(t("cal.empty.copyError"));
    }
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
  const rawLabel = `${weekdayLong}, ${dayMonth}`;
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  return (
    <AppShell>
      <PageHeader
        title={t("cal.title")}
        subtitle={t("cal.subtitle")}
        action={
          <div className="flex items-center gap-2">
            {isToday && liveToday.length > 0 && (
              <span className="inline-flex shrink-0 rounded-full border border-border bg-card px-2.5 py-2 text-[10px] font-black tabular-nums text-muted-foreground sm:px-3 sm:text-[11px]">
                {progressPill}
              </span>
            )}
            <PendingCapsule variant="badge" />
            <Button className="hidden lg:inline-flex" onClick={() => setNewOpen(true)}>
              {t("cal.new")}
            </Button>
          </div>
        }
      />


      <div className="surface mb-2 p-1">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setDate(addDays(date, -1))}
            aria-label={t("cal.prevDay")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <p className="min-w-0 truncate text-center text-sm font-bold">{label}</p>
            <Button
              type="button"
              variant={isToday ? "default" : "outline"}
              size="sm"
              onClick={() => setDate(todayIn(tz))}
              disabled={isToday}
              className="h-8 shrink-0 px-3 text-[11px] disabled:opacity-100"
            >
              {t("cal.today")}
            </Button>
          </div>
          <button
            onClick={() => setDate(addDays(date, 1))}
            aria-label={t("cal.nextDay")}
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
                  "flex flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : isTodayCell
                      ? "border border-foreground/70 text-foreground hover:bg-muted"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  {dayShort(d).replace(".", "").slice(0, 3)}
                </span>
                <span className="text-sm font-black tabular-nums">{Number(d.slice(8, 10))}</span>
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
      ) : (
        <>
          {appts.length === 0 && (
            <section className="surface mb-3 flex flex-col items-center gap-5 px-5 py-7 text-center">
              <p className="max-w-sm font-display text-[18px] font-bold leading-snug">
                {t("cal.empty.welcome")}
              </p>
              <Button variant="outline" size="sm" onClick={copyPublicLink} disabled={!business}>
                <Copy className="size-4" />
                {t("cal.empty.copy")}
              </Button>
            </section>
          )}
          {(data?.ranges.length ?? 0) === 0 && agendaRows.length === 0 ? null : (
            <ul className="space-y-2">
              {agendaRows.map((row, i) => {
                const pastFreeHour = row.kind === "free" && isPastMinute(row.start);
                const pastBlock = row.kind === "block" && new Date(row.block.ends_at).getTime() <= now;
                const due = row.kind === "appt" && needsValidation(row.appt);
                const isNext = row.kind === "appt" && isToday && nextUp?.id === row.appt.id;
                return (
                  <Fragment key={`row-${i}-${row.start}`}>
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
                      <li className={cn("flex items-center gap-2", pastFreeHour && "opacity-45")}>
                        <button
                          disabled={pastFreeHour}
                          onClick={() => {
                            if (pastFreeHour) return;
                            setNewTime(minutesToTime(row.start));
                            setNewOpen(true);
                          }}
                          className="group flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl border border-dashed border-border/70 bg-transparent px-4 py-2.5 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40 disabled:cursor-not-allowed disabled:hover:border-border/70 disabled:hover:bg-transparent"
                        >
                          <span className="w-[3.25rem] shrink-0 text-sm font-bold tabular-nums text-muted-foreground/70">
                            {minutesToTime(row.start)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground/50">
                            {pastFreeHour
                              ? t("cal.slot.past")
                              : `${t("cal.slot.free")} · ${durationLabel(row.end - row.start)}`}
                          </span>
                          <Plus
                            className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground"
                            strokeWidth={2.6}
                          />
                        </button>
                        <button
                          disabled={pastFreeHour}
                          onClick={() => blockSlot(row.start, row.end)}
                          aria-label={t("cal.block")}
                          title={t("cal.block")}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60 transition-colors hover:border-solid hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-dashed disabled:hover:text-muted-foreground/60"
                        >
                          <Lock className="size-4" strokeWidth={2.6} />
                        </button>
                      </li>
                    ) : row.kind === "block" ? (
                      <li
                        key={row.block.id}
                        className={cn(
                          "surface flex items-center gap-3 border-dashed p-4 opacity-80",
                          pastBlock && "opacity-45",
                        )}
                      >
                        <div className="w-[3.25rem] shrink-0 text-center">
                          <p className="text-lg font-black leading-none tabular-nums text-muted-foreground">
                            {minutesToTime(row.start)}
                          </p>
                          <p className="mt-1 text-[11px] font-bold tabular-nums text-muted-foreground/60">
                            {durationLabel(row.end - row.start)}
                          </p>
                        </div>

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
                          "appointment-state surface surface-hover flex items-stretch gap-3 p-3.5",
                          isNext && "ring-1 ring-foreground/30",
                          due && "bg-muted/30",
                        )}
                      >
                        <span
                          data-status={due ? "pending" : row.appt.status}
                          aria-hidden
                          className={cn("appointment-rail w-1 shrink-0 self-stretch", isNext && "w-1.5")}
                        />
                        <div className="w-[3.25rem] shrink-0 self-center">
                          <p className="text-[17px] font-black leading-none tabular-nums">
                            {formatTime(row.appt.starts_at, tz)}
                          </p>
                          {row.appt.ends_at && (
                            <>
                              <p className="mt-1 text-[12px] font-bold leading-none tabular-nums text-muted-foreground">
                                {formatTime(row.appt.ends_at, tz)}
                              </p>
                              <p className="mt-1 text-[10px] font-semibold leading-none tabular-nums text-muted-foreground/70">
                                {durationLabel(Math.max(0, row.end - row.start))}
                              </p>
                            </>
                          )}

                        </div>
                        <div className="min-w-0 flex-1 self-center">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            {isNext && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground">
                                <span className="size-1.5 rounded-full bg-foreground" />
                                {t("cal.next.inline")}
                              </span>
                            )}
                            {due && (
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground">
                                {t("cal.validate.label")}
                              </span>
                            )}
                          </div>
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
                          {due ? (
                            <div className="flex flex-col gap-1.5 sm:flex-row">
                              <Button
                                size="sm"
                                className="h-8 px-3 text-[12px]"
                                onClick={() => validateAppointment(row.appt.id, "completed")}
                              >
                                <Check className="size-3.5" />
                                {t("cal.validate.complete")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-[12px]"
                                onClick={() => validateAppointment(row.appt.id, "no_show")}
                              >
                                <UserX className="size-3.5" />
                                {t("cal.validate.noShow")}
                              </Button>
                            </div>
                          ) : (
                            <AppointmentActions
                              id={row.appt.id}
                              status={row.appt.status}
                              customerName={displayCustomerName(row.appt.customer_name, null, i + 1)}
                              customerPhone={row.appt.customer_phone}
                              startsAt={row.appt.starts_at}
                              serviceName={row.appt.service_name}
                              timezone={tz}
                            />
                          )}
                        </div>
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>
          )}
        </>
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
