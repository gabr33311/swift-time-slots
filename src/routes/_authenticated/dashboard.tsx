import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { useAuth } from "@/hooks/use-auth";
import { displayCustomerName, formatTime, formatDateLong, greetingPt } from "@/lib/format";
import { zonedToUtc, todayIn } from "@/lib/time";
import { Bell, CalendarCheck, Check, ChevronDown, CircleCheck, Clock3, Sun, UserX } from "lucide-react";
import { toast } from "sonner";
import { setAppointmentStatus, type ApptStatus } from "@/lib/appointment-status";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "@/components/appointment-actions";
import { InstallPrompt } from "@/components/install-prompt";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { markBusinessNotificationsRead } from "@/lib/appointment-management.functions";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — SYCRAS" },
      {
        name: "description",
        content: "O resumo do teu dia: marcações, receita prevista e clientes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { business, isLoading, data } = useMyBusiness();
  const [newOpen, setNewOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const markNotificationsRead = useServerFn(markBusinessNotificationsRead);
  const { t, lang } = usePrefs();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isLoading && data && data.count === 0) navigate({ to: "/onboarding" });
  }, [isLoading, data, navigate]);

  const today = business ? todayIn(business.timezone) : null;

  const { data: dayData, isLoading: loadingDay } = useQuery({
    queryKey: ["dashboard-day", business?.id, today],
    enabled: !!business && !!today,
    queryFn: async () => {
      const tz = business!.timezone;
      const from = zonedToUtc(today!, 0, tz).toISOString();
      const to = zonedToUtc(today!, 24 * 60, tz).toISOString();
      const { data: appts } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, customer_name, customer_phone, service_name, price_cents, status",
        )
        .eq("business_id", business!.id)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at");
      const { data: upcoming } = await supabase
        .from("appointments")
        .select("id, starts_at, customer_name, customer_phone, service_name, price_cents, status")
        .eq("business_id", business!.id)
        .gte("starts_at", new Date().toISOString())
        .in("status", ["pending", "confirmed"])
        .order("starts_at")
        .limit(60);

      return { appts: appts ?? [], upcoming: upcoming ?? [] };
    },
  });

  const { data: requestData } = useQuery({
    queryKey: ["dashboard-requests", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const [{ count: pending, error: pendingError }, { data: notifications, error: notificationsError }] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .eq("business_id", business!.id)
            .eq("status", "pending"),
          supabase
            .from("notifications")
            .select("id, title, body, created_at, appointment_id, read_at")
            .eq("business_id", business!.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
      if (pendingError) throw pendingError;
      if (notificationsError) throw notificationsError;
      return { pending: pending ?? 0, notifications: notifications ?? [] };
    },
  });

  const groupedUpcoming = (() => {
    const fmt = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: business?.timezone ?? "Europe/Lisbon",
      }).format(new Date(iso));
    const map = new Map<string, NonNullable<typeof dayData>["upcoming"]>();
    for (const a of dayData?.upcoming ?? []) {
      const key = fmt(a.starts_at);
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  const tz = business?.timezone ?? "Europe/Lisbon";
  const liveToday = (dayData?.appts ?? []).filter(
    (a) => !["cancelled", "no_show", "expired"].includes(a.status),
  );
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


  const todayList = liveToday;
  const overdueList = liveToday.filter((a) => {
    const end = a.ends_at ? new Date(a.ends_at).getTime() : new Date(a.starts_at).getTime() + 3_600_000;
    return end < now && (a.status === "pending" || a.status === "confirmed");
  });
  const nextDays = groupedUpcoming.filter(([day]) => day !== today);

  async function closeAppointment(id: string, status: "completed" | "no_show") {
    if (!business) return;
    const res = await setAppointmentStatus({ id, businessId: business.id, status });
    if (!res.ok) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    toast.success(t("dash.overdue.saved"));
    qc.invalidateQueries({ queryKey: ["dashboard-day"] });
  }

  return (
    <AppShell>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate font-display text-[26px] font-bold leading-tight tracking-tight">
          {greetingPt(new Date(), lang)}
          {user?.user_metadata?.["full_name"] ? `, ${user.user_metadata["full_name"]}` : ""}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <CalendarCheck className="size-4" /> {t("dash.new")}
          </Button>
          <NotificationBell
            notifications={requestData?.notifications ?? []}
            pending={requestData?.pending ?? 0}
            onSelectAppointment={(apptId) => {
              setFocusId(apptId);
              window.setTimeout(() => {
                document
                  .getElementById(`appt-${apptId}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 120);
            }}
            onMarkRead={async () => {
              if (!business) return;
              const result = await markNotificationsRead({ data: { businessId: business.id } });
              if (result.ok) qc.invalidateQueries({ queryKey: ["dashboard-requests"] });
            }}
          />
        </div>
      </div>

      <InstallPrompt />

      {focusAppt && (
        <section
          data-status={focusAppt.status}
          className="appointment-state surface flex items-center gap-4 p-4"
        >
          <span
            data-status={focusAppt.status}
            className="appointment-status-disc flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl border border-border text-[13px] font-black tabular-nums text-foreground"
          >
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

      {overdueList.length > 0 && (
        <section className="surface mt-3 p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <Clock3 className="size-4" /> {t("dash.overdue.title")}
          </p>
          <ul className="mt-3 space-y-2">
            {overdueList.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black tabular-nums">{formatTime(a.starts_at, tz)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  {displayCustomerName(a.customer_name, null, 1)}
                </span>
                <Button size="sm" variant="outline" onClick={() => closeAppointment(a.id, "completed")}>
                  <Check className="size-4" /> {t("dash.overdue.done")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => closeAppointment(a.id, "no_show")}>
                  <UserX className="size-4" /> {t("dash.overdue.noshow")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="surface mt-3 flex items-center gap-3 p-4">
        <Sun className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-500"
              style={{ width: `${dayProgress}%` }}
            />
          </div>
          <p className="mt-1.5 truncate text-xs font-semibold text-muted-foreground">
            {liveToday.length === 0
              ? t("dash.progress.free")
              : t("dash.progress.done")
                  .replace("{done}", String(doneCount))
                  .replace("{total}", String(liveToday.length))}
          </p>
        </div>
        <p className="shrink-0 text-sm font-black tabular-nums">{formatPrice(dayRevenue)}</p>
      </section>

      <section className="mt-6">
        <h2 className="mb-2.5 px-1 font-display text-sm font-bold uppercase tracking-[0.05em] text-muted-foreground">
          {t("dash.todayList")}
        </h2>
        {loadingDay ? (
          <LoadingRows />
        ) : todayList.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title={t("dash.today.empty")}
            description={t("dash.empty.body")}
            action={
              <Button onClick={() => setNewOpen(true)}>
                <CalendarCheck className="mr-2 size-4" /> {t("dash.new")}
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {todayList.map((a, i) => (
              <ApptRow
                key={a.id}
                appt={a}
                index={i}
                timezone={tz}
                focused={focusId === a.id}
                onAutoOpenDone={() => setFocusId(null)}
              />
            ))}
          </ul>
        )}
      </section>

      {nextDays.length > 0 && (
        <section className="mt-6 space-y-4">
          <h2 className="px-1 font-display text-sm font-bold uppercase tracking-[0.05em] text-muted-foreground">
            {t("dash.nextDays")}
          </h2>
          {nextDays.map(([day, items]) => (
            <DayGroup
              key={day}
              dayLabel={formatDateLong(`${day}T12:00:00Z`, business!.timezone)}
              confirmedCount={items.filter((a) => a.status === "confirmed").length}
              pendingCount={items.filter((a) => a.status === "pending").length}
              collapsibleDefaultOpen={false}
              forceOpen={items.some((a) => a.id === focusId)}
            >
              <ul className="space-y-2.5">
                {items.map((a, i) => (
                  <ApptRow
                    key={a.id}
                    appt={a}
                    index={i}
                    timezone={business!.timezone}
                    focused={focusId === a.id}
                    onAutoOpenDone={() => setFocusId(null)}
                  />
                ))}
              </ul>
            </DayGroup>
          ))}
        </section>
      )}

      {business && (
        <NewAppointmentDialog business={business} open={newOpen} onOpenChange={setNewOpen} />
      )}
    </AppShell>
  );
}

function ApptRow({
  appt,
  index,
  timezone,
  focused,
  onAutoOpenDone,
}: {
  appt: {
    id: string;
    starts_at: string;
    customer_name: string;
    customer_phone: string | null;
    service_name: string;
    status: ApptStatus;
  };
  index: number;
  timezone: string;
  focused: boolean;
  onAutoOpenDone: () => void;
}) {
  const name = displayCustomerName(appt.customer_name, null, index + 1);
  return (
    <li
      id={`appt-${appt.id}`}
      data-status={appt.status}
      className={cn(
        "appointment-state surface surface-hover flex items-center gap-3.5 p-4 transition-shadow",
        focused && "ring-2 ring-primary",
      )}
    >
      <span className="w-14 shrink-0 text-center text-lg font-black tabular-nums text-foreground">
        {formatTime(appt.starts_at, timezone)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-snug">{name}</p>
        <p className="truncate text-sm font-normal leading-snug text-muted-foreground">
          {appt.service_name}
        </p>
      </div>
      <AppointmentActions
        id={appt.id}
        status={appt.status}
        customerName={name}
        customerPhone={appt.customer_phone}
        startsAt={appt.starts_at}
        serviceName={appt.service_name}
        timezone={timezone}
        autoOpen={focused}
        onAutoOpenDone={onAutoOpenDone}
      />
    </li>
  );
}

function NotificationBell({
  notifications,
  pending,
  onMarkRead,
  onSelectAppointment,
}: {
  notifications: {
    id: string;
    title: string;
    body: string | null;
    read_at: string | null;
    appointment_id?: string | null;
  }[];
  pending: number;
  onMarkRead: () => Promise<void>;
  onSelectAppointment: (appointmentId: string) => void;
}) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const unread = pending > 0 ? notifications.filter((n) => !n.read_at).length : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("dash.notifications")}
        className="relative flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell
          className={cn("size-5", unread > 0 && "animate-[bell-ring_1.2s_ease-in-out_infinite] text-primary")}
          strokeWidth={2.5}
        />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary-foreground">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="animate-enter absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-4 shadow-lift">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold">{t("dash.notifications")}</h2>
              {unread > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await onMarkRead();
                  }}
                >
                  <Check className="size-4" /> {t("dash.markRead")}
                </Button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("dash.notifications.empty")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!item.appointment_id}
                      onClick={() => {
                        if (!item.appointment_id) return;
                        setOpen(false);
                        onSelectAppointment(item.appointment_id);
                      }}
                      className="flex w-full gap-3 rounded-xl py-3 text-left first:pt-2 last:pb-0 enabled:hover:bg-muted/60"
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          item.read_at ? "bg-muted" : "bg-primary",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{item.title}</p>
                        {item.body && (
                          <p className="truncate text-xs text-muted-foreground">{item.body}</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DayGroup({
  dayLabel,
  confirmedCount,
  pendingCount,
  collapsibleDefaultOpen,
  forceOpen,
  children,
}: {
  dayLabel: string;
  confirmedCount: number;
  pendingCount: number;
  collapsibleDefaultOpen: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(collapsibleDefaultOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center gap-2 px-1 text-left"
      >
        <span className="font-display text-sm font-bold uppercase capitalize tracking-[0.05em] text-muted-foreground">
          {dayLabel}
        </span>
        {confirmedCount > 0 && (
          <span
            data-status="confirmed"
            className="appointment-count-pill inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums"
          >
            {confirmedCount}
            <CircleCheck className="size-4" aria-hidden="true" />
          </span>
        )}
        {pendingCount > 0 && (
          <span
            data-status="pending"
            className="appointment-count-pill inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums"
          >
            {pendingCount}
            <Clock3 className="size-4 animate-status-shake" aria-hidden="true" />
          </span>
        )}
        <ChevronDown
          className={cn("ml-auto size-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open && children}
    </section>
  );
}
