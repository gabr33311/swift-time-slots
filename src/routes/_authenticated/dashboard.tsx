import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, StatCard, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { useAuth } from "@/hooks/use-auth";
import { displayCustomerName, formatPrice, formatTime, greetingPt } from "@/lib/format";
import { zonedToUtc, todayIn } from "@/lib/time";
import {
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Hourglass,
  BarChart3,

} from "lucide-react";
import { InstallPrompt } from "@/components/install-prompt";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";

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
  const { user } = useAuth();
  const { business, isLoading, data } = useMyBusiness();
  const [newOpen, setNewOpen] = useState(false);

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
        .limit(6);
      return { appts: appts ?? [], upcoming: upcoming ?? [] };
    },
  });

  const active = (dayData?.appts ?? []).filter(
    (a) => a.status === "confirmed" || a.status === "pending" || a.status === "completed",
  );
  const revenue = active.reduce((sum, a) => sum + a.price_cents, 0);
  const cancelled = (dayData?.appts ?? []).filter((a) => a.status === "cancelled").length;
  const waiting = useWaitlistCount(business?.id);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
          {greetingPt()}
          {user?.user_metadata?.["full_name"] ? `, ${user.user_metadata["full_name"]}` : ""}
        </h1>
        <p className="mt-1 text-sm font-normal text-muted-foreground">Aqui está o teu dia.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Hoje"
          value={active.length}
          hint="marcações"
          to="/calendar"
          icon={<CalendarDays className="size-4" />}
        />
        <StatCard
          label="Cancelamentos"
          value={cancelled}
          hint="hoje"
          to="/calendar"
          dimmed={cancelled === 0}
          icon={<CalendarX className="size-4" />}
        />
        <StatCard
          label="Lista de espera"
          value={waiting}
          hint="clientes à espera"
          to="/waitlist"
          dimmed={waiting === 0}
          icon={<Hourglass className="size-4" />}
        />
        <StatCard
          label="Estatísticas"
          value={formatPrice(revenue, business?.currency ?? "EUR")}
          hint="receita do dia"
          to="/analytics"
          dimmed={revenue === 0}
          icon={<BarChart3 className="size-4" />}
        />
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
          <ul className="space-y-2.5">
            {dayData!.upcoming.map((a, i) => (
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {business && (
        <NewAppointmentDialog business={business} open={newOpen} onOpenChange={setNewOpen} />
      )}
    </AppShell>
  );
}

function useWaitlistCount(businessId: string | undefined) {
  const { data } = useQuery({
    queryKey: ["waitlist-count", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { count } = await supabase
        .from("waitlist_entries")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId!)
        .eq("status", "waiting");
      return count ?? 0;
    },
  });
  return data ?? 0;
}

