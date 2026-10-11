import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ErrorState, LoadingRows } from "@/components/ui-bits";
import { currentLocale, displayCustomerName, formatTime } from "@/lib/format";
import { layoutLanes } from "@/lib/calendar-layout";
import { usePrefs } from "@/lib/prefs";
import { addDays, minutesToTime, timeToMinutes, todayIn, weekdayOf, zonedToUtc } from "@/lib/time";
import { cn } from "@/lib/utils";

type WeekAppt = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  customer_name: string;
  service_name: string;
  status: string;
  staff_id: string | null;
};

const PX_PER_MIN = 1.1;
const released = (s: string) => s === "cancelled" || s === "expired";

/** Minutes from midnight of an ISO instant, as seen in the business timezone. */
function minuteOf(iso: string, tz: string) {
  return timeToMinutes(formatTime(iso, tz));
}

/**
 * Seven days side by side (desktop): the whole week at a glance. Tapping an
 * appointment opens its sheet; tapping a day header opens that day.
 */
export function CalendarWeek({
  businessId,
  tz,
  weekStart,
  staffFilter,
  onOpen,
  onPickDay,
}: {
  businessId: string;
  tz: string;
  weekStart: string;
  staffFilter: string;
  onOpen: (id: string) => void;
  onPickDay: (date: string) => void;
}) {
  const { t } = usePrefs();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = todayIn(tz);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar", businessId, "week", weekStart],
    queryFn: async () => {
      const from = zonedToUtc(weekStart, 0, tz).toISOString();
      const to = zonedToUtc(addDays(weekStart, 7), 0, tz).toISOString();
      const results = await Promise.all([
        supabase
          .from("appointments")
          .select("id, starts_at, ends_at, customer_name, service_name, status, staff_id")
          .eq("business_id", businessId)
          .gte("starts_at", from)
          .lt("starts_at", to)
          .order("starts_at"),
        supabase
          .from("working_hours")
          .select("weekday, start_time, end_time")
          .eq("business_id", businessId),
        supabase
          .from("blocked_times")
          .select("id, starts_at, ends_at, staff_id")
          .eq("business_id", businessId)
          .lt("starts_at", to)
          .gt("ends_at", from),
      ]);
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
      const [appts, hours, blocks] = results;
      return {
        appts: (appts.data ?? []) as WeekAppt[],
        hours: (hours.data ?? []) as { weekday: number; start_time: string; end_time: string }[],
        blocks: (blocks.data ?? []) as {
          id: string;
          starts_at: string;
          ends_at: string;
          staff_id: string | null;
        }[],
      };
    },
  });

  if (isLoading) return <LoadingRows rows={5} />;
  if (isError || !data) {
    return <ErrorState message={t("cal.loadError")} onRetry={() => void refetch()} />;
  }

  const matches = (id: string | null) => staffFilter === "all" || id === staffFilter || !id;
  const appts = data.appts.filter((a) => matches(a.staff_id));
  const openDays = new Set(data.hours.map((h) => h.weekday));

  // One shared hour range for the week: opening hours, widened to fit anything booked outside them.
  const starts = [
    ...data.hours.map((h) => timeToMinutes(h.start_time.slice(0, 5))),
    ...appts.map((a) => minuteOf(a.starts_at, tz)),
  ];
  const ends = [
    ...data.hours.map((h) => timeToMinutes(h.end_time.slice(0, 5))),
    ...appts.map((a) => (a.ends_at ? minuteOf(a.ends_at, tz) : minuteOf(a.starts_at, tz) + 60)),
  ];
  const dayStart = starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 8 * 60;
  const dayEnd = ends.length
    ? Math.min(24 * 60, Math.max(dayStart + 60, Math.ceil(Math.max(...ends) / 60) * 60))
    : 20 * 60;
  const height = (dayEnd - dayStart) * PX_PER_MIN;
  const hours = Array.from(
    { length: Math.floor((dayEnd - dayStart) / 60) + 1 },
    (_, i) => dayStart + i * 60,
  );
  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const weekdayLabel = (d: string) =>
    new Intl.DateTimeFormat(currentLocale(), { weekday: "short", timeZone: "UTC" })
      .format(new Date(`${d}T12:00:00Z`))
      .replace(".", "");

  return (
    <div className="surface animate-enter overflow-hidden rounded-[12px]! p-0 shadow-none!">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border bg-card">
        <span />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPickDay(d)}
            className="flex flex-col items-center gap-0.5 border-l border-border py-2.5 transition-colors hover:bg-muted/50"
          >
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {weekdayLabel(d)}
            </span>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                d === today && "bg-brand text-brand-foreground",
              )}
            >
              {Number(d.slice(8, 10))}
            </span>
          </button>
        ))}
      </div>

      <div
        className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] bg-muted/40"
        style={{ height }}
      >
        <div className="relative bg-card">
          {hours.map((m) => (
            <span
              key={m}
              className={cn(
                "absolute right-2 text-[11px] font-bold leading-none tabular-nums text-muted-foreground",
                m <= dayStart
                  ? "translate-y-1"
                  : m >= dayEnd
                    ? "-translate-y-[120%]"
                    : "-translate-y-1/2",
              )}
              style={{ top: (m - dayStart) * PX_PER_MIN }}
            >
              {minutesToTime(m)}
            </span>
          ))}
        </div>

        {days.map((d) => {
          const closed = !openDays.has(weekdayOf(d));
          const dayAppts = appts.filter((a) => dayOf(a.starts_at) === d);
          const rows = dayAppts.map((a) => {
            const start = minuteOf(a.starts_at, tz);
            const rawEnd = a.ends_at ? minuteOf(a.ends_at, tz) : start + 60;
            return { a, start, end: rawEnd > start ? rawEnd : start + 60 };
          });
          const lanes = layoutLanes(
            rows.map((r) => ({
              id: r.a.id,
              start: r.start,
              end: r.end,
              released: released(r.a.status),
            })),
          );
          const dayBlocks = data.blocks.filter((b) => {
            const from = zonedToUtc(d, 0, tz).getTime();
            const to = zonedToUtc(d, 24 * 60, tz).getTime();
            return (
              matches(b.staff_id) &&
              new Date(b.starts_at).getTime() < to &&
              new Date(b.ends_at).getTime() > from
            );
          });
          return (
            <div
              key={d}
              className={cn(
                "relative border-l border-border",
                closed &&
                  "bg-[repeating-linear-gradient(135deg,transparent_0_8px,color-mix(in_oklch,var(--foreground)_4%,transparent)_8px_10px)]",
              )}
            >
              {hours.map((m) => (
                <span
                  key={m}
                  aria-hidden
                  className="absolute inset-x-0 border-t border-border/50"
                  style={{ top: (m - dayStart) * PX_PER_MIN }}
                />
              ))}
              {dayBlocks.map((b) => {
                const from = zonedToUtc(d, 0, tz).getTime();
                const to = zonedToUtc(d, 24 * 60, tz).getTime();
                const s =
                  new Date(b.starts_at).getTime() <= from ? dayStart : minuteOf(b.starts_at, tz);
                const e = new Date(b.ends_at).getTime() >= to ? dayEnd : minuteOf(b.ends_at, tz);
                return (
                  <div
                    key={b.id}
                    aria-hidden
                    className="absolute inset-x-0.5 rounded-md border border-dashed border-border bg-muted/70"
                    style={{
                      top: (Math.max(s, dayStart) - dayStart) * PX_PER_MIN,
                      height: Math.max(
                        (Math.min(e, dayEnd) - Math.max(s, dayStart)) * PX_PER_MIN,
                        4,
                      ),
                    }}
                  />
                );
              })}
              {rows.map(({ a, start, end }, i) => {
                const lane = lanes.get(a.id) ?? { lane: 0, lanes: 1 };
                const h = Math.max((end - start) * PX_PER_MIN - 2, 22);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onOpen(a.id)}
                    data-status={a.status}
                    className={cn(
                      "appointment-state appointment-pop absolute overflow-hidden rounded-md border pl-2 pr-1 text-left transition-shadow hover:shadow-lift",
                      released(a.status) ? "z-[5] opacity-60" : "z-10",
                    )}
                    style={{
                      top: (start - dayStart) * PX_PER_MIN,
                      height: h,
                      left: `calc(2px + (100% - 4px) * ${lane.lane / lane.lanes})`,
                      width: `calc((100% - 4px) / ${lane.lanes} - ${lane.lanes > 1 ? 1 : 0}px)`,
                    }}
                    title={`${formatTime(a.starts_at, tz)} · ${a.customer_name} · ${a.service_name}`}
                  >
                    <span
                      data-status={a.status}
                      aria-hidden
                      className="appointment-rail absolute inset-y-0 left-0 w-[3px]"
                    />
                    <span className="block truncate text-[11px] font-bold leading-tight">
                      {displayCustomerName(a.customer_name, null, i + 1)}
                    </span>
                    {h >= 34 && (
                      <span className="block truncate text-[10px] font-medium tabular-nums leading-tight text-muted-foreground">
                        {formatTime(a.starts_at, tz)} · {a.service_name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
