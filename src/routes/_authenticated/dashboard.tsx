import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { useAuth } from "@/hooks/use-auth";
import { displayCustomerName, formatPrice, formatTime, formatDateLong, greetingPt } from "@/lib/format";
import { zonedToUtc, todayIn } from "@/lib/time";
import { Bell, CalendarCheck, CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "@/components/appointment-actions";
import { InstallPrompt } from "@/components/install-prompt";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { markBusinessNotificationsRead } from "@/lib/appointment-management.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Schedivo" },
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
  const markNotificationsRead = useServerFn(markBusinessNotificationsRead);

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
        .select("id, starts_at, customer_name, service_name, price_cents, status")
        .eq("business_id", business!.id)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at");
      const { data: upcoming } = await supabase
        .from("appointments")
        .select("id, starts_at, customer_name, service_name, price_cents, status")
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

  const active = (dayData?.appts ?? []).filter(
    (a) => a.status === "confirmed" || a.status === "pending" || a.status === "completed",
  );
  const cancelled = (dayData?.appts ?? []).filter((a) => a.status === "cancelled").length;
  const counts = {
    confirmed: active.filter((a) => a.status === "confirmed").length,
    pending: requestData?.pending ?? 0,
    completed: active.filter((a) => a.status === "completed").length,
  };

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
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
          {greetingPt()}
          {user?.user_metadata?.["full_name"] ? `, ${user.user_metadata["full_name"]}` : ""}
        </h1>
        <p className="mt-1 text-sm font-normal text-muted-foreground">Aqui está o teu dia.</p>
      </div>

      {(requestData?.notifications.length ?? 0) > 0 && (
        <section className="surface mt-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Bell className="size-4 text-primary" /> Notificações
            </h2>
            {requestData?.notifications.some((item) => !item.read_at) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  if (!business) return;
                  const result = await markNotificationsRead({ data: { businessId: business.id } });
                  if (result.ok) qc.invalidateQueries({ queryKey: ["dashboard-requests"] });
                }}
              >
                <Check className="size-4" /> Marcar lidas
              </Button>
            )}
          </div>
          <ul className="mt-3 divide-y divide-border">
            {requestData?.notifications.map((item) => (
              <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("mt-1 size-2 shrink-0 rounded-full", item.read_at ? "bg-muted" : "bg-primary")} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{item.title}</p>
                  {item.body && <p className="truncate text-xs text-muted-foreground">{item.body}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="surface p-5">
        <div className="flex items-center justify-between gap-3">
          <Link to="/calendar" className="font-display text-base font-bold hover:text-primary">
            Marcações de hoje
          </Link>
          <span className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
            <CalendarDays className="size-4" />
            {dayData?.appts.length ?? 0}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Confirmadas", value: counts.confirmed, dot: "bg-success", to: "/calendar" },
            { label: "Pendentes", value: counts.pending, dot: "bg-warning", to: "/pendentes" },
            { label: "Canceladas", value: cancelled, dot: "bg-destructive", to: "/pendentes" },
            {
              label: "Concluídas",
              value: counts.completed,
              dot: "bg-muted-foreground",
              to: "/appointments",
            },
          ].map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className="surface-hover flex flex-col rounded-2xl border border-border bg-muted/40 p-3"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-foreground/70">
                <span className={cn("size-2.5 rounded-full", s.dot)} />
                {s.label}
              </span>
              <p className="font-display mt-2 text-[28px] font-bold leading-none tabular-nums">
                {s.value}
              </p>
            </Link>
          ))}
        </div>
      </div>



      <InstallPrompt />




      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight">Próximas marcações</h2>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <CalendarCheck className="size-4" /> Nova marcação
          </Button>
        </div>

        {loadingDay ? (
          <LoadingRows />
        ) : (dayData?.upcoming.length ?? 0) === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title="Sem marcações para já."
            description="Quando os teus clientes marcarem, vais vê-las aqui."
            action={
              <Button onClick={() => setNewOpen(true)}>
                <CalendarCheck className="mr-2 size-4" /> Nova marcação
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
                    ? "Hoje"
                    : formatDateLong(`${day}T12:00:00Z`, business!.timezone)
                }
                count={items.length}
                collapsibleDefaultOpen={gi === 0}
              >
                <ul className="space-y-2.5">
                  {items.map((a, i) => (
                    <li key={a.id} className="surface surface-hover flex items-center gap-3.5 p-4">
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

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-sm font-bold tabular-nums">
                          {formatPrice(a.price_cents, business!.currency)}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                      <AppointmentActions
                        id={a.id}
                        status={a.status}
                        customerName={displayCustomerName(a.customer_name, null, i + 1)}
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

function DayGroup({
  dayLabel,
  count,
  collapsibleDefaultOpen,
  children,
}: {
  dayLabel: string;
  count: number;
  collapsibleDefaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(collapsibleDefaultOpen);
  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mb-2.5 flex w-full items-center gap-2 px-1 text-left"
      >
        <span className="font-display text-sm font-bold uppercase capitalize tracking-[0.05em] text-muted-foreground">
          {dayLabel}
        </span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
          {count}
        </span>
        <ChevronDown
          className={cn("ml-auto size-4 text-muted-foreground transition-transform", !open && "-rotate-90")}
        />
      </button>
      {open && children}
    </section>
  );
}
