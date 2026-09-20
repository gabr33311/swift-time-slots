import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setAppointmentStatus } from "@/lib/appointment-status";
import { useMyBusiness } from "@/hooks/use-business";
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
import { Menu, CheckCircle2, XCircle, CalendarCheck, BellRing, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhonePt } from "@/lib/phone";
import { formatDateLong, formatTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { AppointmentStatusIndicator } from "@/components/appointment-status-indicator";

type Status = "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";

const STATUS_STYLES: Record<Status, string> = {
  pending: "appointment-status-pending",
  confirmed: "appointment-status-confirmed",
  completed: "appointment-status-completed",
  cancelled: "appointment-status-cancelled",
  no_show: "appointment-status-cancelled",
  expired: "appointment-status-cancelled",
};

/** Quick status actions (confirm, complete, cancel, remind) for one appointment. */
export function AppointmentActions({
  id,
  status,
  customerName,
  customerPhone,
  startsAt,
  serviceName,
  timezone,
  autoOpen,
  onAutoOpenDone,
}: {
  id: string;
  status: Status;
  customerName: string;
  customerPhone?: string | null;
  startsAt?: string;
  serviceName?: string;
  timezone?: string;
  autoOpen?: boolean;
  onAutoOpenDone?: () => void;
}) {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { business } = useMyBusiness();

  useEffect(() => {
    if (!autoOpen) return;
    const timer = window.setTimeout(() => {
      setMenuOpen(true);
      onAutoOpenDone?.();
    }, 420);
    return () => window.clearTimeout(timer);
  }, [autoOpen, onAutoOpenDone]);

  async function setStatus(next: Status) {
    if (!business) return;
    setBusy(true);
    const result = await setAppointmentStatus({
      id,
      businessId: business.id,
      status: next,
      note: next === "cancelled" ? t("acts.note.cancelled") : t("acts.note.changed"),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(next === "cancelled" ? t("acts.toast.cancelled") : t("acts.toast.updated"));
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["dashboard-day"] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["requests"] });
    qc.invalidateQueries({ queryKey: ["dashboard-requests"] });
  }

  async function deleteAppointment() {
    if (!business) return;
    setBusy(true);
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("business_id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("appt.toast.updateError"));
      return;
    }
    toast.success(t("acts.toast.deleted"));
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["appointments"] });
  }

  const canCancel = status !== "cancelled" && status !== "completed";

  const tz = timezone ?? "Europe/Lisbon";
  const phone = customerPhone ? normalizePhonePt(customerPhone) : null;
  const canRemind = !!phone && !!startsAt && status !== "cancelled" && status !== "completed";

  function remind() {
    if (!phone || !startsAt) return;
    const message = `${t("acts.remind.hello")}${customerName}${t("acts.remind.body1")}${
      serviceName ? `${t("acts.remind.of")}${serviceName}` : ""
    }${t("acts.remind.on")}${formatDateLong(startsAt, tz)}${t("acts.remind.at")}${formatTime(startsAt, tz)}${t("acts.remind.bye")}`;
    window.open(
      `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener",
    );
  }

  return (
    <>
      <AppointmentStatusIndicator
        status={status}
        customerName={customerName}
        onConfirm={() => setStatus("confirmed")}
        onCancel={() => setConfirmOpen(true)}
      />
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-9 shrink-0 rounded-full border border-current bg-card",
              STATUS_STYLES[status],
            )}
            aria-label={`${t("acts.opts.forLabel")}${customerName}`}
            disabled={busy}
          >
            <Menu className="size-[18px] text-muted-foreground" strokeWidth={2.7} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64 space-y-1 p-1.5">
          {status === "pending" && (
            <DropdownMenuItem
              className="py-2.5 font-bold text-foreground"
              onClick={() => setStatus("confirmed")}
            >
              <CalendarCheck className="mr-1 size-4" /> {t("acts.confirm")}
            </DropdownMenuItem>
          )}
          {status !== "completed" && status !== "cancelled" && (
            <DropdownMenuItem
              className="py-2.5 font-bold text-foreground"
              onClick={() => setStatus("completed")}
            >
              <CheckCircle2 className="mr-1 size-4" /> {t("acts.markCompleted")}
            </DropdownMenuItem>
          )}
          {status === "completed" && (
            <DropdownMenuItem
              className="py-2.5 font-bold text-foreground"
              onClick={() => setStatus("confirmed")}
            >
              <RotateCcw className="mr-1 size-4" /> {t("acts.revertCompleted")}
            </DropdownMenuItem>
          )}
          {status === "completed" && (
            <DropdownMenuItem
              className="py-2.5 font-bold text-foreground"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1 size-4" /> {t("acts.deleteAppt")}
            </DropdownMenuItem>
          )}
          {canRemind && (
            <DropdownMenuItem className="py-2.5 font-bold text-foreground" onClick={remind}>
              <BellRing className="mr-1 size-4" /> {t("acts.remindWhatsapp")}
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem
              className="py-2.5 font-bold text-foreground"
              onClick={() => setConfirmOpen(true)}
            >
              <XCircle className="mr-1 size-4" /> {t("acts.cancelAppt")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("acts.dialog.cancelTitle")}
              {customerName}?
            </AlertDialogTitle>
            <AlertDialogDescription>{t("acts.dialog.cancelDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("acts.dialog.keep")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setStatus("cancelled")}>
              {t("acts.cancelAppt")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("acts.dialog.deleteTitle")}
              {customerName}?
            </AlertDialogTitle>
            <AlertDialogDescription>{t("acts.dialog.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("acts.dialog.keep")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAppointment}>
              {t("acts.deleteAppt")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
