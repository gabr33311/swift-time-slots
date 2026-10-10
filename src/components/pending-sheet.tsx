import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, BellRing, Info, Loader2, Mail, Phone, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { invalidateAppointmentData, setAppointmentStatus } from "@/lib/appointment-status";
import { displayCustomerName, formatTime, formatDateLong } from "@/lib/format";

type PendingAppt = {
  id: string;
  starts_at: string;
  customer_name: string;
  service_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  notes: string | null;
};

function usePendingList() {
  const { business } = useMyBusiness();
  return useQuery({
    queryKey: ["pending-capsule", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("appointments")
        .select("id, starts_at, customer_name, service_name, customer_phone, customer_email, notes")
        .eq("business_id", business!.id)
        .eq("status", "pending")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(30);
      if (error) throw error;
      return (rows ?? []) as PendingAppt[];
    },
  });
}

/** Approve/decline drawer. With `onlyId`, it focuses on that single booking. */
export function PendingDecisionDrawer({
  open,
  onOpenChange,
  onlyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onlyId?: string | null;
}) {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const { data } = usePendingList();
  const tz = business?.timezone ?? "Europe/Lisbon";
  const all = data ?? [];
  const list = onlyId ? all.filter((a) => a.id === onlyId) : all;

  const [busyId, setBusyId] = useState<string | null>(null);
  // Declining frees the customer's slot: it takes a second tap to confirm.
  const [declineId, setDeclineId] = useState<string | null>(null);

  async function decide(id: string, status: "confirmed" | "cancelled") {
    if (!business || busyId) return;
    setBusyId(id);
    const res = await setAppointmentStatus({ id, businessId: business.id, status });
    setBusyId(null);
    setDeclineId(null);
    if (!res.ok) {
      toast.error(res.message || t("pf.common.saveError"));
      return;
    }
    if (!("emailed" in res && res.emailed)) {
      toast.success(status === "confirmed" ? t("cal.pending.confirmed") : t("cal.pending.cancelled"));
    }
    void invalidateAppointmentData(qc);
    if (onlyId || list.length <= 1) onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <DrawerHeader className="pb-1 text-center">
          <DrawerTitle>{t("cal.pending.title")}</DrawerTitle>
          <DrawerDescription>
            {t("cal.pending.pill").replace("{n}", String(list.length))}
          </DrawerDescription>
        </DrawerHeader>
        <ul className="animate-stagger mx-auto max-h-[60vh] w-full max-w-md space-y-2 overflow-y-auto px-5 pb-2">
          {list.map((a, i) => (
            <li key={a.id} className="surface flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex max-w-full items-center gap-1.5 text-left"
                      aria-label="Ver detalhes do cliente"
                    >
                      <span className="truncate text-[15px] font-bold leading-snug underline-offset-2 hover:underline">
                        {displayCustomerName(a.customer_name, null, i + 1)}
                      </span>
                      <Info className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-72 space-y-2.5 text-sm">
                    <p className="flex items-start gap-2">
                      <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {a.customer_phone ? (
                        <a href={`tel:${a.customer_phone}`} className="break-all font-medium">{a.customer_phone}</a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </p>
                    <p className="flex items-start gap-2">
                      <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {a.customer_email ? (
                        <a href={`mailto:${a.customer_email}`} className="break-all font-medium">{a.customer_email}</a>
                      ) : <span className="text-muted-foreground">—</span>}
                    </p>
                    <p className="flex items-start gap-2">
                      <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="whitespace-pre-wrap font-medium">
                        {a.notes?.trim() || <span className="text-muted-foreground">{t("cal.note.label")}: —</span>}
                      </span>
                    </p>
                  </PopoverContent>
                </Popover>
                <p className="truncate text-sm leading-snug text-muted-foreground">{a.service_name}</p>
                <p className="truncate text-xs font-semibold tabular-nums text-muted-foreground">
                  {formatDateLong(a.starts_at, tz)} · {formatTime(a.starts_at, tz)}
                </p>
              </div>
              {declineId === a.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDeclineId(null)}
                    disabled={busyId === a.id}
                    className="h-10 shrink-0 rounded-full px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {t("acts.dialog.keep")}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(a.id, "cancelled")}
                    disabled={busyId === a.id}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-foreground px-3 text-sm font-black transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    {busyId === a.id && <Loader2 className="size-4 animate-spin" />}
                    {t("cal.pending.declineAsk")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    aria-label={t("cal.pending.confirm")}
                    title={t("cal.pending.confirm")}
                    onClick={() => decide(a.id, "confirmed")}
                    disabled={!!busyId}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
                  >
                    {busyId === a.id ? (
                      <Loader2 className="size-[18px] animate-spin" />
                    ) : (
                      <Check className="size-[18px]" strokeWidth={3} />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={t("cal.pending.cancel")}
                    title={t("cal.pending.cancel")}
                    onClick={() => setDeclineId(a.id)}
                    disabled={!!busyId}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <X className="size-[18px]" strokeWidth={3} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}

/** Floating decision capsule: approve or decline pending bookings from anywhere. */
export function PendingCapsule({ variant = "bar" }: { variant?: "bar" | "badge" }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const { data } = usePendingList();
  const list = data ?? [];
  if (list.length === 0) return null;

  return (
    <>
      {variant === "badge" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("cal.pending.pill").replace("{n}", String(list.length))}
          className="pending-halo relative flex h-9 items-center gap-1.5 rounded-full border border-border bg-card pl-2.5 pr-3 text-left"
        >
          <BellRing className="size-[15px] text-muted-foreground" strokeWidth={2.6} />
          <span className="text-[13px] font-black tabular-nums">{list.length}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="appointment-state mb-3 flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left"
          data-status="pending"
        >
          <span className="appointment-status-disc flex size-9 shrink-0 items-center justify-center rounded-full border border-border">
            <BellRing className="size-[17px] text-muted-foreground" strokeWidth={2.6} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">
            {t("cal.pending.pill").replace("{n}", String(list.length))}
          </span>
          <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {t("cal.pending.review")}
          </span>
        </button>
      )}
      <PendingDecisionDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
