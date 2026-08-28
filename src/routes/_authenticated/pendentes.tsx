import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { formatPrice, formatTime, formatDateLong } from "@/lib/format";
import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateBusinessAppointmentStatus } from "@/lib/appointment-management.functions";
import { z } from "zod";

type Tab = "pending" | "accepted" | "refused";

export const Route = createFileRoute("/_authenticated/pendentes")({
  validateSearch: z.object({ tab: z.enum(["pending", "accepted", "refused"]).optional() }),
  head: () => ({
    meta: [
      { title: "Pedidos de marcação — Schedivo" },
      {
        name: "description",
        content: "Aceita ou recusa os pedidos de marcação feitos pelos teus clientes.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PendingPage,
});

const TABS: { id: Tab; label: string }[] = [
  { id: "pending", label: "Pendentes" },
  { id: "accepted", label: "Aceites" },
  { id: "refused", label: "Recusadas" },
];

function PendingPage() {
  const search = Route.useSearch();
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>(search.tab ?? "pending");
  const [busy, setBusy] = useState<string | null>(null);
  const updateStatus = useServerFn(updateBusinessAppointmentStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["requests", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, customer_name, customer_phone, service_name, price_cents, status, notes, source",
        )
        .eq("business_id", business!.id)
        .order("starts_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const items = (data ?? []).filter((a) =>
    tab === "pending"
      ? a.status === "pending"
      : tab === "accepted"
        ? a.status === "confirmed" || a.status === "completed"
        : a.status === "cancelled" || a.status === "no_show",
  );

  async function decide(id: string, accept: boolean) {
    setBusy(id);
    const result = await updateStatus({
      data: {
        appointmentId: id,
        status: accept ? "confirmed" : "cancelled",
        note: accept ? "Pedido aceite pelo negócio" : "Pedido recusado pelo negócio",
      },
    });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(accept ? "Marcação aceite." : "Pedido recusado.");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["requests"] }),
      qc.invalidateQueries({ queryKey: ["dashboard-day"] }),
      qc.invalidateQueries({ queryKey: ["dashboard-requests"] }),
      qc.invalidateQueries({ queryKey: ["appointments"] }),
      qc.invalidateQueries({ queryKey: ["calendar"] }),
    ]);
  }

  return (
    <AppShell>
      <PageHeader title="Pedidos" subtitle="Marcações pedidas pelos teus clientes." />

      <div className="mb-5 flex gap-1 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant="ghost"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-[13px] font-bold transition-colors",
              tab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingRows rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Clock className="size-6" />}
          title="Nada por aqui."
          description="Os pedidos dos clientes aparecem nesta lista."
        />
      ) : (
        <ul className="space-y-2.5">
          {items.map((a) => (
            <li key={a.id} className="surface p-4">
              <div className="flex items-start gap-3">
                <span className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-accent px-2 py-2 text-sm font-bold tabular-nums text-primary">
                  {formatTime(a.starts_at, business!.timezone)}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {formatTime(a.ends_at, business!.timezone)}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-snug">{a.customer_name}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.service_name}</p>
                  <p className="truncate text-xs font-bold text-muted-foreground">
                    {formatDateLong(a.starts_at, business!.timezone)}
                  </p>
                  {a.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-sm font-bold tabular-nums">
                    {formatPrice(a.price_cents, business!.currency)}
                  </span>
                  <StatusBadge status={a.status} />
                </div>
              </div>

              {a.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={busy === a.id}
                    onClick={() => decide(a.id, true)}
                  >
                    <Check className="mr-1.5 size-4" /> Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-destructive"
                    disabled={busy === a.id}
                    onClick={() => decide(a.id, false)}
                  >
                    <X className="mr-1.5 size-4" /> Recusar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
