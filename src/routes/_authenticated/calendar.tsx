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
import { Check, ChevronLeft, ChevronRight, Copy, Lock, Moon, Plus, RotateCcw, StickyNote, Unlock, UserX } from "lucide-react";
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

/**
 * Parses the real working ranges of the day into minutes from midnight and
 * merges overlapping/duplicated rows (business-wide + per-staff entries can
 * describe the same window), so the agenda never renders the same slot twice.
 */
function rangesFromRows(rows: { start: string; end: string }[]): { start: number; end: number }[] {
  const sorted = rows
    .map((r) => ({ start: timeToMinutes(r.start.slice(0, 5)), end: timeToMinutes(r.end.slice(0, 5)) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const r of sorted) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
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

/** Vertical density of the time grid: one minute = this many pixels. */

const PX_PER_MIN = 0.95;
const ZOOM_MIN = 0.85;
const ZOOM_MAX = 1.3;

/** Empty stretches become tappable slots of the business booking step. */
function freeChunks(start: number, end: number, step: number): AgendaRow[] {
  const span = end - start;
  if (span <= 0) return [];
  const size = step;
  const out: AgendaRow[] = [];
  let cursor = start;
  while (end - cursor > size * 1.5) {
    out.push({ kind: "free", start: cursor, end: cursor + size });
    cursor += size;
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
  dayFrom: string,
  dayTo: string,
): AgendaRow[] {
  const fromMs = new Date(dayFrom).getTime();
  const toMs = new Date(dayTo).getTime();
  const busy: AgendaRow[] = [
    ...appts.map((a) => {
      const start = minuteOfDay(a.starts_at, tz);
      const rawEnd = a.ends_at ? minuteOfDay(a.ends_at, tz) : start + 60;
      return { kind: "appt" as const, appt: a, start, end: rawEnd > start ? rawEnd : start + 60 };
    }),
    // Multi-day blocks are clamped to the visible day, so they show up on every
    // day they cover instead of only the one they started on.
    ...blocks.map((b) => {
      const startMs = new Date(b.starts_at).getTime();
      const endMs = new Date(b.ends_at).getTime();
      const start = startMs <= fromMs ? 0 : minuteOfDay(b.starts_at, tz);
      const end = endMs >= toMs ? 24 * 60 : minuteOfDay(b.ends_at, tz);
      return { kind: "block" as const, block: b, start, end: end > start ? end : 24 * 60 };
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
  const [showPast, setShowPast] = useState(false);
  // Pinch-to-zoom scales the timeline density (two fingers apart = more detail).
  const [zoom, setZoom] = useState(1);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const nowRef = useRef<HTMLLIElement | null>(null);
  const scrolledFor = useRef<string | null>(null);
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
            .lt("starts_at", to)
            .gt("ends_at", from)
            .order("starts_at"),
        ]);
      return {
        from,
        to,
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
  const agendaRows = data
    ? buildAgenda(data.ranges, appts, blocks, tz, step, data.from, data.to)
    : [];

  // Weekends / closed days: nothing is scheduled and nothing is bookable.
  const isDayOff =
    !!data && data.ranges.length === 0 && appts.length === 0 && blocks.length === 0;

  const isToday = date === todayIn(tz);
  const nowMinutes = timeToMinutes(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(new Date()),
  );

  // Grid geometry: the day spans the working hours, widened to fit anything
  // scheduled outside them, snapped to whole hours.
  const spanStarts = [
    ...(data?.ranges ?? []).map((r) => r.start),
    ...agendaRows.map((r) => r.start),
  ];
  const spanEnds = [...(data?.ranges ?? []).map((r) => r.end), ...agendaRows.map((r) => r.end)];
  const dayStart = Math.max(0, Math.floor(Math.min(8 * 60, ...spanStarts) / 60) * 60);
  const dayEnd = Math.min(24 * 60, Math.ceil(Math.max(20 * 60, ...spanEnds) / 60) * 60);
  const gridHeight = (dayEnd - dayStart) * PX_PER_MIN;
  const hourMarks = Array.from(
    { length: Math.max(1, Math.floor((dayEnd - dayStart) / 60) + 1) },
    (_, i) => dayStart + i * 60,
  );
  const freeRows = agendaRows.filter((r): r is Extract<AgendaRow, { kind: "free" }> => r.kind === "free");
  const blockRows = agendaRows.filter((r): r is Extract<AgendaRow, { kind: "block" }> => r.kind === "block");
  const apptRows = agendaRows.filter((r): r is Extract<AgendaRow, { kind: "appt" }> => r.kind === "appt");


  // On today's agenda, land on the current moment instead of the top of the day.
  useEffect(() => {
    if (!isToday || isLoading || scrolledFor.current === date) return;
    const node = nowRef.current;
    if (!node) return;
    scrolledFor.current = date;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [date, isToday, isLoading, gridHeight]);



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
    if (isPastMinute(endMin)) return;
    const from = isToday ? Math.max(startMin, nowMinutes) : startMin;
    const start = zonedToUtc(date, from, tz);
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

  function touchDistance(e: React.TouchEvent) {
    const [a, b] = [e.touches[0]!, e.touches[1]!];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function onPinchStart(e: React.TouchEvent) {
    if (e.touches.length !== 2) return;
    pinchRef.current = { dist: touchDistance(e), zoom };
  }

  function onPinchMove(e: React.TouchEvent) {
    const base = pinchRef.current;
    if (!base || e.touches.length !== 2) return;
    const ratio = touchDistance(e) / (base.dist || 1);
    // Horizontal stretch only: rows keep their default height, columns breathe.
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, base.zoom * ratio)));
  }

  function onPinchEnd() {
    pinchRef.current = null;
    // Soft snap back to the default resolution when close to it.
    setZoom((z) => (Math.abs(z - 1) < 0.06 ? 1 : z));
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
  const rawLabel = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  }).format(labelDate);
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


      <div className="surface sticky top-0 z-20 mb-2 p-1 backdrop-blur-xl supports-[backdrop-filter]:bg-card/85">
        <div className="flex h-10 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDate(todayIn(tz))}
            disabled={isToday}
            className="h-8 shrink-0 rounded-full px-3 text-[11px] font-black disabled:opacity-45"
          >
            <RotateCcw className="size-3.5" />
            {t("cal.today")}
          </Button>
          <button
            onClick={() => setDate(addDays(date, -1))}
            aria-label={t("cal.prevDay")}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-bold">{label}</p>
          <button
            onClick={() => setDate(addDays(date, 1))}
            aria-label={t("cal.nextDay")}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                  "flex flex-col items-center gap-0.5 rounded-2xl border border-transparent py-1.5 transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : isTodayCell
                      ? "border-foreground/70 text-foreground hover:bg-muted"
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
      ) : isDayOff ? (
        <section className="surface flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Moon className="size-7 text-muted-foreground" strokeWidth={2.2} />
          <p className="font-display text-[20px] font-black leading-snug">{t("cal.offday.title")}</p>
          <p className="max-w-xs text-sm leading-snug text-muted-foreground">
            {t("cal.offday.desc")}
          </p>
        </section>
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

          <div
            onTouchStart={onPinchStart}
            onTouchMove={onPinchMove}
            onTouchEnd={onPinchEnd}
            onTouchCancel={onPinchEnd}
            className="surface overflow-hidden p-0"
            style={{
              transform: `scaleX(${zoom})`,
              transformOrigin: "center top",
              transition: pinchRef.current ? "none" : "transform 160ms ease-out",
              touchAction: "pan-y",
            }}
          >
            <div className="flex">
              <div
                className="relative w-14 shrink-0 border-r border-border/60"
                style={{ height: gridHeight }}
              >
                {hourMarks.map((m) => (
                  <span
                    key={`h-${m}`}
                    className="absolute right-2 -translate-y-1/2 text-[11px] font-bold tabular-nums text-muted-foreground/70"
                    style={{ top: (m - dayStart) * PX_PER_MIN }}
                  >
                    {minutesToTime(m)}
                  </span>
                ))}
              </div>

              <div className="relative min-w-0 flex-1" style={{ height: gridHeight }}>
                {hourMarks.map((m) => (
                  <span
                    key={`l-${m}`}
                    aria-hidden
                    className="absolute inset-x-0 border-t border-border/50"
                    style={{ top: (m - dayStart) * PX_PER_MIN }}
                  />
                ))}

                {freeRows.map((row) => {
                  const past = isPastMinute(row.end);
                  const bookFrom =
                    isToday && row.start < nowMinutes
                      ? Math.min(row.end - 5, Math.ceil(nowMinutes / 5) * 5)
                      : row.start;
                  return (
                    <div
                      key={`free-${row.start}`}
                      className="absolute inset-x-1"
                      style={{
                        top: (row.start - dayStart) * PX_PER_MIN,
                        height: Math.max((row.end - row.start) * PX_PER_MIN - 2, 18),
                      }}
                    >
                      <button
                        type="button"
                        disabled={past}
                        title={past ? t("cal.slot.past") : t("cal.slot.free")}
                        onClick={() => {
                          setNewTime(minutesToTime(bookFrom));
                          setNewOpen(true);
                        }}
                        className={cn(
                          "group flex size-full items-center justify-center rounded-lg border border-transparent transition-colors",
                          past
                            ? "cursor-not-allowed bg-muted/25"
                            : "hover:border-dashed hover:border-foreground/30 hover:bg-muted/50",
                        )}
                      >
                        {!past && (
                          <Plus
                            className="size-4 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100"
                            strokeWidth={2.6}
                          />
                        )}
                      </button>
                      {!past && (row.end - row.start) * PX_PER_MIN >= 32 && (
                        <button
                          type="button"
                          onClick={() => blockSlot(row.start, row.end)}
                          aria-label={t("cal.block")}
                          title={t("cal.block")}
                          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-60"
                        >
                          <Lock className="size-3" strokeWidth={2.6} />
                        </button>
                      )}
                    </div>
                  );
                })}

                {blockRows.map((row) => (
                  <div
                    key={`block-${row.block.id}-${row.start}`}
                    className="absolute inset-x-1 z-10 overflow-hidden rounded-xl border border-dashed border-border bg-muted/60 px-2 py-1"
                    style={{
                      top: (row.start - dayStart) * PX_PER_MIN,
                      height: Math.max((row.end - row.start) * PX_PER_MIN - 2, 26),
                    }}
                  >
                    <div className="flex items-start gap-1">
                      <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-muted-foreground">
                        {t("cal.blocked")}
                        {row.block.reason ? ` · ${row.block.reason}` : ""}
                      </p>
                      <button
                        onClick={() => unblock(row.block.id)}
                        aria-label={t("cal.unblock")}
                        title={t("cal.unblock")}
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Unlock className="size-3" strokeWidth={2.6} />
                      </button>
                    </div>
                  </div>
                ))}

                {apptRows.map((row, i) => {
                  const due = needsValidation(row.appt);
                  const isNext = isToday && nextUp?.id === row.appt.id;
                  const height = Math.max((row.end - row.start) * PX_PER_MIN - 2, 34);
                  const roomy = height >= 62;
                  const name = displayCustomerName(row.appt.customer_name, null, i + 1);
                  return (
                    <div
                      key={row.appt.id}
                      data-status={due ? "pending" : row.appt.status}
                      className={cn(
                        "appointment-state surface surface-hover absolute inset-x-1 z-10 overflow-hidden p-0",
                        isNext && "ring-1 ring-foreground/40",
                      )}
                      style={{ top: (row.start - dayStart) * PX_PER_MIN, height }}
                    >
                      <span
                        data-status={due ? "pending" : row.appt.status}
                        aria-hidden
                        className="appointment-rail absolute inset-y-0 left-0 w-1"
                      />
                      <div className="flex h-full min-w-0 flex-col gap-0.5 py-1 pl-3 pr-1">
                        <div className="flex items-start gap-1">
                          <p className="min-w-0 flex-1 truncate text-[11px] font-black tabular-nums">
                            {formatTime(row.appt.starts_at, tz)}
                            {row.appt.ends_at && ` – ${formatTime(row.appt.ends_at, tz)}`}
                            {due && (
                              <span className="ml-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                                {t("cal.validate.label")}
                              </span>
                            )}
                            {isNext && !due && (
                              <span className="ml-1.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                                {t("cal.next.inline")}
                              </span>
                            )}
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {due ? (
                              <>
                                <button
                                  type="button"
                                  aria-label={t("cal.validate.complete")}
                                  title={t("cal.validate.complete")}
                                  onClick={() => validateAppointment(row.appt.id, "completed")}
                                  className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                                >
                                  <Check className="size-3.5" strokeWidth={3} />
                                </button>
                                <button
                                  type="button"
                                  aria-label={t("cal.validate.noShow")}
                                  title={t("cal.validate.noShow")}
                                  onClick={() => validateAppointment(row.appt.id, "no_show")}
                                  className="flex size-6 items-center justify-center rounded-full border border-border text-muted-foreground"
                                >
                                  <UserX className="size-3.5" strokeWidth={2.6} />
                                </button>
                              </>
                            ) : (
                              <AppointmentActions
                                id={row.appt.id}
                                status={row.appt.status}
                                customerName={name}
                                customerPhone={row.appt.customer_phone}
                                startsAt={row.appt.starts_at}
                                serviceName={row.appt.service_name}
                                timezone={tz}
                              />
                            )}
                          </div>
                        </div>

                        <p className="truncate font-display text-[14px] font-black leading-tight">
                          {name}
                        </p>

                        {roomy && (
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                              {row.appt.service_name}
                            </p>
                            {row.appt.price_cents != null && (
                              <p className="shrink-0 text-[11px] font-black tabular-nums">
                                {formatPrice(row.appt.price_cents)}
                              </p>
                            )}
                          </div>
                        )}

                        {roomy && row.appt.notes?.trim() && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                aria-label={t("cal.note.label")}
                                className="flex max-w-full items-center gap-1 self-start rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
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
                    </div>
                  );
                })}

                {isToday && nowMinutes >= dayStart && nowMinutes <= dayEnd && (
                  <div
                    ref={nowRef}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: (nowMinutes - dayStart) * PX_PER_MIN }}
                  >
                    <span className="-ml-1 size-2 rounded-full bg-foreground" />
                    <span className="h-px flex-1 bg-foreground/70" />
                  </div>
                )}
              </div>
            </div>
          </div>
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
