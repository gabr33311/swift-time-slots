import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { updateBusinessAppointmentStatus } from "@/lib/appointment-management.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreVertical, CheckCircle2, XCircle, CalendarCheck } from "lucide-react";

type Status = "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";

/** Quick status actions (confirm, complete, cancel) for one appointment. */
export function AppointmentActions({
  id,
  status,
  customerName,
}: {
  id: string;
  status: Status;
  customerName: string;
}) {
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const updateStatus = useServerFn(updateBusinessAppointmentStatus);

  async function setStatus(next: Status) {
    setBusy(true);
    const result = await updateStatus({
      data: {
        appointmentId: id,
        status: next as "confirmed" | "completed" | "cancelled" | "no_show",
        note: next === "cancelled" ? "Cancelada pelo negócio" : "Estado alterado pelo negócio",
      },
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(next === "cancelled" ? "Marcação cancelada." : "Marcação actualizada.");
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["dashboard-day"] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["requests"] });
    qc.invalidateQueries({ queryKey: ["dashboard-requests"] });
  }

  const canCancel = status !== "cancelled" && status !== "completed";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-label={`Opções da marcação de ${customerName}`}
            disabled={busy}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "pending" && (
            <DropdownMenuItem onClick={() => setStatus("confirmed")}>
              <CalendarCheck className="mr-2 size-4" /> Confirmar
            </DropdownMenuItem>
          )}
          {status !== "completed" && status !== "cancelled" && (
            <DropdownMenuItem onClick={() => setStatus("completed")}>
              <CheckCircle2 className="mr-2 size-4" /> Marcar como concluída
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmOpen(true)}>
              <XCircle className="mr-2 size-4" /> Cancelar marcação
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar a marcação de {customerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              O horário fica novamente livre para outros clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction onClick={() => setStatus("cancelled")}>
              Cancelar marcação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
