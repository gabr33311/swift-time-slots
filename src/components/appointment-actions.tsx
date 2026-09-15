import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Bell, CheckCircle2, XCircle, CalendarCheck, BellRing } from "lucide-react";
import { normalizePhonePt } from "@/lib/phone";
import { formatDateLong, formatTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

type Status = "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired";

/** Quick status actions (confirm, complete, cancel, remind) for one appointment. */
export function AppointmentActions({
  id,
  status,
  customerName,
  customerPhone,
  startsAt,
  serviceName,
  timezone,
}: {
  id: string;
  status: Status;
  customerName: string;
  customerPhone?: string | null;
  startsAt?: string;
  serviceName?: string;
  timezone?: string;
}) {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { business } = useMyBusiness();

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "size-9 shrink-0 rounded-full border border-border bg-card text-muted-foreground",
              status === "pending" &&
                "animate-pending-bell border-warning/50 bg-warning/15 text-warning hover:bg-warning/25 hover:text-warning",
            )}
            aria-label={`${t("acts.opts.forLabel")}${customerName}`}
            disabled={busy}
          >
            <Bell className="size-[18px]" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64 space-y-1 p-1.5">
          {status === "pending" && (
            <DropdownMenuItem
              className="animate-confirm-pulse bg-success/12 py-2.5 font-bold text-success focus:bg-success/20 focus:text-success"
              onClick={() => setStatus("confirmed")}
            >
              <CalendarCheck className="mr-1 size-4" /> {t("acts.confirm")}
            </DropdownMenuItem>
          )}
          {status !== "completed" && status !== "cancelled" && (
            <DropdownMenuItem
              className="bg-info/12 py-2.5 font-bold text-info focus:bg-info/20 focus:text-info"
              onClick={() => setStatus("completed")}
            >
              <CheckCircle2 className="mr-1 size-4" /> {t("acts.markCompleted")}
            </DropdownMenuItem>
          )}
          {canRemind && (
            <DropdownMenuItem
              className="bg-warning/12 py-2.5 font-bold text-warning-foreground focus:bg-warning/20 focus:text-warning-foreground"
              onClick={remind}
            >
              <BellRing className="mr-1 size-4 text-warning" /> {t("acts.remindWhatsapp")}
            </DropdownMenuItem>
          )}
          {canCancel && (
            <DropdownMenuItem
              className="bg-destructive/10 py-2.5 font-bold text-destructive focus:bg-destructive/20 focus:text-destructive"
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
            <AlertDialogTitle>{t("acts.dialog.cancelTitle")}{customerName}?</AlertDialogTitle>
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
    </>
  );
}
