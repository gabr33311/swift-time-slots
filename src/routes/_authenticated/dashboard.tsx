import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, StatCard, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice, formatTime, greetingPt } from "@/lib/format";
import { zonedToUtc, todayIn } from "@/lib/time";
import { CalendarCheck, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — Marca" },
      { name: "description", content: "O resumo do teu dia: marcações, receita prevista e clientes." },
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

  const bookingUrl =
    typeof window !== "undefined" && business
      ? `${window.location.origin}/book/${business.slug}`
      : "";

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {greetingPt()}
          {user?.user_metadata?.["full_name"] ? `, ${user.user_metadata["full_name"]}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Aqui está o teu dia.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hoje" value={active.length} hint="marcações" />
        <StatCard label="Previsto" value={formatPrice(revenue, business?.currency ?? "EUR")} />
        <StatCard label="Cancelamentos" value={cancelled} />
        <StatCard label="Clientes" value={<ClientCount businessId={business?.id} />} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Próximas marcações</h2>
          <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
            Nova marcação
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(bookingUrl);
                    toast.success("Link copiado.");
                  }}
                >
                  <Copy className="mr-2 size-4" /> Copiar link de marcações
                </Button>
                <Link to="/booking-page">
                  <Button variant="outline">
                    <Share2 className="mr-2 size-4" /> Partilhar página
                  </Button>
                </Link>
              </div>
            }
          />
        ) : (
          <ul className="space-y-2">
            {dayData!.upcoming.map((a) => (
              <li key={a.id} className="surface flex items-center gap-4 p-4">
                <span className="w-14 text-sm font-semibold tabular-nums">
                  {formatTime(a.starts_at, business!.timezone)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.customer_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.service_name}</p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {formatPrice(a.price_cents, business!.currency)}
                </span>
                <StatusBadge status={a.status} />
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

function ClientCount({ businessId }: { businessId: string | undefined }) {
  const { data } = useQuery({
    queryKey: ["customer-count", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { count } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId!);
      return count ?? 0;
    },
  });
  return <>{data ?? 0}</>;
}
