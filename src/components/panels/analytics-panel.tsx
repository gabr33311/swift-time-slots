import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingRows, StatCard } from "@/components/ui-bits";
import { useMyBusiness } from "@/hooks/use-business";
import { formatPrice } from "@/lib/format";

export function AnalyticsPanel() {
  const { business } = useMyBusiness();

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase
        .from("appointments")
        .select("service_name, price_cents, status, starts_at")
        .eq("business_id", business!.id)
        .gte("starts_at", from)
        .limit(1000);
      return data ?? [];
    },
  });

  const rows = data ?? [];
  const done = rows.filter((r) => r.status === "completed" || r.status === "confirmed");
  const revenue = done.reduce((s, r) => s + r.price_cents, 0);
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const noShow = rows.filter((r) => r.status === "no_show").length;

  const byService = Object.entries(
    done.reduce<Record<string, { count: number; cents: number }>>((acc, r) => {
      const cur = acc[r.service_name] ?? { count: 0, cents: 0 };
      cur.count += 1;
      cur.cents += r.price_cents;
      acc[r.service_name] = cur;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].cents - a[1].cents);

  const max = byService[0]?.[1].cents ?? 1;

  if (isLoading) return <LoadingRows rows={3} />;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Marcações" value={done.length} />
        <StatCard label="Receita" value={formatPrice(revenue, business?.currency ?? "EUR")} />
        <StatCard label="Cancelamentos" value={cancelled} />
        <StatCard label="Faltas" value={noShow} />
      </div>

      <section className="surface mt-6 p-5">
        <h2 className="text-base font-bold">Serviços mais rentáveis</h2>
        {byService.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Ainda sem dados suficientes.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {byService.slice(0, 8).map(([name, v]) => (
              <li key={name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {v.count} · {formatPrice(v.cents, business?.currency ?? "EUR")}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (v.cents / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
