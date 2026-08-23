import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getMyClientAppointments, cancelMyClientAppointment } from "@/lib/client-area.functions";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows, StatusBadge } from "@/components/ui-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatPrice, formatTime, formatDateLong } from "@/lib/format";
import { CalendarDays, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/minhas-marcacoes")({
  head: () => ({
    meta: [
      { title: "As minhas marcações — Schedivo" },
      {
        name: "description",
        content: "Consulta e cancela as tuas marcações na tua conta Schedivo.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyBookings,
});

function MyBookings() {
  const qc = useQueryClient();
  const fetchMine = useServerFn(getMyClientAppointments);
  const cancelMine = useServerFn(cancelMyClientAppointment);
  const [pendingCancel, setPendingCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["my-client-appointments"],
    queryFn: () => fetchMine({}),
  });

  async function cancel(id: string) {
    setBusy(true);
    const res = await cancelMine({ data: { id } });
    setBusy(false);
    setPendingCancel(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Marcação cancelada.");
    qc.invalidateQueries({ queryKey: ["my-client-appointments"] });
  }

  const list = data ?? [];

  return (
    <main className="animate-enter mx-auto w-full max-w-2xl px-5 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Início
      </Link>
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
        As minhas marcações
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Consulta o histórico e cancela marcações futuras.
      </p>

      <div className="mt-6">
        {isLoading ? (
          <LoadingRows />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title="Ainda não tens marcações."
            description="Quando marcares num negócio, aparecem aqui."
          />
        ) : (
          <ul className="space-y-2.5">
            {list.map((a) => {
              const tz = a.business?.timezone ?? "Europe/Lisbon";
              const upcoming =
                new Date(a.starts_at).getTime() > Date.now() && a.status !== "cancelled";
              return (
                <li key={a.id} className="surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold">{a.service_name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.business?.name ?? ""}
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {formatDateLong(a.starts_at, tz)} · {formatTime(a.starts_at, tz)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-bold tabular-nums">
                        {formatPrice(a.price_cents, a.business?.currency ?? "EUR")}
                      </span>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                  {upcoming && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingCancel(a.id)}
                        disabled={busy}
                      >
                        Cancelar marcação
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendingCancel} onOpenChange={(o) => !o && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta marcação?</AlertDialogTitle>
            <AlertDialogDescription>
              O horário fica novamente disponível para outros clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingCancel && cancel(pendingCancel)}>
              Cancelar marcação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
