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
import { Bell, CalendarCheck, Check, ChevronDown, CircleCheck, Clock3 } from "lucide-react";
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
        .select("id, starts_at, customer_name, customer_phone, service_name, price_cents, status")
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

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
            {greetingPt(new Date(), lang)}
            {user?.user_metadata?.["full_name"] ? `, ${user.user_metadata["full_name"]}` : ""}
          </h1>
        </div>
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

      <InstallPrompt />




      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight">{t("dash.upcoming")}</h2>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <CalendarCheck className="size-4" /> {t("dash.new")}
          </Button>
        </div>

        {loadingDay ? (
          <LoadingRows />
        ) : (dayData?.upcoming.length ?? 0) === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title={t("dash.empty.title")}
            description={t("dash.empty.body")}
            action={
              <Button onClick={() => setNewOpen(true)}>
                <CalendarCheck className="mr-2 size-4" /> {t("dash.new")}
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            {groupedUpcoming.map(([day, items], gi) => (
              <DayGroup
                key={day}
                dayLabel={
                  day === today
                    ? t("dash.todayLabel")
                    : formatDateLong(`${day}T12:00:00Z`, business!.timezone)
                }
                confirmedCount={items.filter((a) => a.status === "confirmed").length}
                pendingCount={items.filter((a) => a.status === "pending").length}
                collapsibleDefaultOpen={gi === 0}
                forceOpen={items.some((a) => a.id === focusId)}
              >
                <ul className="space-y-2.5">
                  {items.map((a, i) => (
                    <li
                      key={a.id}
                      id={`appt-${a.id}`}
                      data-status={a.status}
                      className={cn(
                        "appointment-state surface surface-hover flex items-center gap-3.5 p-4 transition-shadow",
                        focusId === a.id && "ring-2 ring-primary",
                      )}
                    >
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-accent px-2 py-2 text-sm font-bold tabular-nums text-primary">
                        {formatTime(a.starts_at, business!.timezone)}
                      </span>
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
                        timezone={business!.timezone}
                        autoOpen={focusId === a.id}
                        onAutoOpenDone={() => setFocusId(null)}
                      />
                    </li>
                  ))}
                </ul>
              </DayGroup>
            ))}
          </div>
        )}

      </section>

      {business && (
        <NewAppointmentDialog business={business} open={newOpen} onOpenChange={setNewOpen} />
      )}
    </AppShell>
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
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-bold tabular-nums appointment-status-confirmed">
            {confirmedCount}
            <CircleCheck className="size-4" aria-hidden="true" />
          </span>
        )}
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-bold tabular-nums appointment-status-pending">
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
