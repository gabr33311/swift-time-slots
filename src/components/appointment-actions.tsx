import { useQueryClient } from "@tanstack/react-query";
import { FormError } from "@/components/ui-bits";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { invalidateAppointmentData, setAppointmentStatus } from "@/lib/appointment-status";
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
import {
  BellRing,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Settings2,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhonePt } from "@/lib/phone";
import { formatDateLong, formatTime } from "@/lib/format";
import { timeToMinutes, zonedToUtc } from "@/lib/time";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { AppointmentStatusIndicator } from "@/components/appointment-status-indicator";

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
  autoOpen,
  onAutoOpenDone,
  hideStatusChip,
  triggerClassName,
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
  hideStatusChip?: boolean;
  triggerClassName?: string;
}) {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
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

  async function setStatus(next: Status): Promise<boolean> {
    if (!business || busy) return false;
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
      return false;
    }
    // Confirming a pending booking already shows its own email outcome toast.
    if (!result.emailed) {
      toast.success(next === "cancelled" ? t("acts.toast.cancelled") : t("acts.toast.updated"));
    }
    void invalidateAppointmentData(qc);
    return true;
  }

  async function deleteAppointment() {
    if (!business || busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("business_id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("acts.err.generic"));
      return;
    }
    setDeleteOpen(false);
    toast.success(t("acts.toast.deleted"));
    void invalidateAppointmentData(qc);
  }

  async function cancelAppointment() {
    if (await setStatus("cancelled")) setConfirmOpen(false);
  }

  const tz = timezone ?? "Europe/Lisbon";
  const isFuture = !!startsAt && new Date(startsAt).getTime() > Date.now();
  const canCancel = status === "pending" || status === "confirmed";
  // Completing an appointment that hasn't started yet makes no sense.
  const canComplete = (status === "pending" || status === "confirmed" || status === "no_show") && !isFuture;
  const canReschedule = !!startsAt && (status === "pending" || status === "confirmed");

  function openReschedule() {
    if (!startsAt) return;
    setNewDate(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(startsAt)));
    setNewTime(formatTime(startsAt, tz));
    setRescheduleError(null);
    setRescheduleOpen(true);
  }

  async function saveReschedule() {
    if (!business || busy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate) || !/^\d{2}:\d{2}$/.test(newTime)) {
      setRescheduleError(t("acts.err.dateTime"));
      return;
    }
    const start = zonedToUtc(newDate, timeToMinutes(newTime), tz);
    if (start.getTime() <= Date.now()) {
      setRescheduleError(t("acts.err.past"));
      return;
    }
    setBusy(true);
    setRescheduleError(null);
    // Keep the original span (service + buffer) at the new start.
    const { data: current } = await supabase
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("id", id)
      .maybeSingle();
    const span = current?.ends_at
      ? new Date(current.ends_at).getTime() - new Date(current.starts_at).getTime()
      : 3_600_000;
    const { error } = await supabase
      .from("appointments")
      .update({
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + span).toISOString(),
      })
      .eq("id", id)
      .eq("business_id", business.id);
    if (error) {
      setBusy(false);
      // 23P01 = appointments_no_overlap: that professional is already booked.
      setRescheduleError(error.code === "23P01" ? t("acts.err.conflict") : t("acts.err.generic"));
      return;
    }
    await supabase.from("appointment_status_history").insert({
      appointment_id: id,
      business_id: business.id,
      status,
      note: t("acts.note.rescheduled"),
    });
    setBusy(false);
    setRescheduleOpen(false);
    toast.success(
      t("acts.toast.rescheduled").replace(
        "{when}",
        `${formatDateLong(start.toISOString(), tz)} · ${formatTime(start.toISOString(), tz)}`,
      ),
    );
    void invalidateAppointmentData(qc);
  }

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
      {!hideStatusChip && (
        <AppointmentStatusIndicator
          status={status}
          customerName={customerName}
          onConfirm={() => setStatus("confirmed")}
          onCancel={() => setConfirmOpen(true)}
        />
      )}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "tap-target relative size-9 shrink-0 rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted",
              triggerClassName,
            )}
            aria-label={`${t("acts.opts.forLabel")}${customerName}`}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <Loader2 className="size-[18px] animate-spin text-muted-foreground" />
            ) : (
              <Settings2
                className={cn(
                  "size-[18px]",
                  status === "completed" ? "text-muted-foreground" : "text-foreground",
                )}
                strokeWidth={2.5}
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          avoidCollisions
          collisionPadding={{ top: 12, bottom: 96, left: 8, right: 8 }}
          className="z-[60] min-w-64 space-y-1 p-1.5"
        >
          {status === "pending" && (
            <DropdownMenuItem
              className="py-2.5 font-bold text-foreground"
              onClick={() => setStatus("confirmed")}
            >
              <CalendarCheck className="mr-1 size-4" /> {t("acts.confirm")}
            </DropdownMenuItem>
          )}
          {canReschedule && (
            <DropdownMenuItem className="py-2.5 font-bold text-foreground" onClick={openReschedule}>
              <CalendarClock className="mr-1 size-4" /> {t("acts.reschedule")}
            </DropdownMenuItem>
          )}
          {canComplete && (
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
            <AlertDialogCancel disabled={busy}>{t("acts.dialog.keep")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                // Stay open until the server answers, so failures are visible here.
                e.preventDefault();
                void cancelAppointment();
              }}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
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
            <AlertDialogCancel disabled={busy}>{t("acts.dialog.keep")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void deleteAppointment();
              }}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("acts.deleteAppt")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rescheduleOpen} onOpenChange={(o) => !busy && setRescheduleOpen(o)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("acts.dialog.rescheduleTitle")}
              {customerName}
            </DialogTitle>
            <DialogDescription>
              {startsAt
                ? t("acts.dialog.rescheduleDesc").replace(
                    "{when}",
                    `${formatDateLong(startsAt, tz)} · ${formatTime(startsAt, tz)}`,
                  )
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`rs-date-${id}`}>{t("cal.field.date")}</Label>
              <Input
                id={`rs-date-${id}`}
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`rs-time-${id}`}>{t("cal.field.time")}</Label>
              <Input
                id={`rs-time-${id}`}
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
              />
            </div>
          </div>
          <FormError message={rescheduleError} />
          <Button className="w-full" onClick={saveReschedule} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("acts.reschedule")}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
