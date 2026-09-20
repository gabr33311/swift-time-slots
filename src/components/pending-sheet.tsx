import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, BellRing } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { setAppointmentStatus } from "@/lib/appointment-status";
import { displayCustomerName, formatTime, formatDateLong } from "@/lib/format";

type PendingAppt = {
  id: string;
  starts_at: string;
  customer_name: string;
  service_name: string;
};

/** Floating decision capsule: approve or decline pending bookings from anywhere. */
export function PendingCapsule() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const tz = business?.timezone ?? "Europe/Lisbon";

  const { data } = useQuery({
    queryKey: ["pending-capsule", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("appointments")
        .select("id, starts_at, customer_name, service_name")
        .eq("business_id", business!.id)
        .eq("status", "pending")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(30);
      if (error) throw error;
      return (rows ?? []) as PendingAppt[];
    },
  });

  const list = data ?? [];
  if (list.length === 0) return null;

  async function decide(id: string, status: "confirmed" | "cancelled") {
    if (!business) return;
    const res = await setAppointmentStatus({ id, businessId: business.id, status });
    if (!res.ok) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    toast.success(status === "confirmed" ? t("cal.pending.confirmed") : t("cal.pending.cancelled"));
    qc.invalidateQueries({ queryKey: ["pending-capsule"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    if (list.length <= 1) setOpen(false);
  }

  return (
    <>
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

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="pb-1 text-center">
            <DrawerTitle>{t("cal.pending.title")}</DrawerTitle>
            <DrawerDescription>
              {t("cal.pending.pill").replace("{n}", String(list.length))}
            </DrawerDescription>
          </DrawerHeader>
          <ul className="mx-auto max-h-[60vh] w-full max-w-md space-y-2 overflow-y-auto px-5 pb-2">
            {list.map((a, i) => (
              <li key={a.id} className="surface flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold leading-snug">
                    {displayCustomerName(a.customer_name, null, i + 1)}
                  </p>
                  <p className="truncate text-sm leading-snug text-muted-foreground">
                    {a.service_name}
                  </p>
                  <p className="truncate text-xs font-semibold tabular-nums text-muted-foreground">
                    {formatDateLong(a.starts_at, tz)} · {formatTime(a.starts_at, tz)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("cal.pending.confirm")}
                  onClick={() => decide(a.id, "confirmed")}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/60 text-emerald-500 transition-colors hover:bg-emerald-500/10"
                >
                  <Check className="size-[18px]" strokeWidth={3} />
                </button>
                <button
                  type="button"
                  aria-label={t("cal.pending.cancel")}
                  onClick={() => decide(a.id, "cancelled")}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-red-500/60 text-red-500 transition-colors hover:bg-red-500/10"
                >
                  <X className="size-[18px]" strokeWidth={3} />
                </button>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  );
}
