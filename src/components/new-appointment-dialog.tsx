import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { zonedToUtc, todayIn } from "@/lib/time";
import type { Business } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";

export function NewAppointmentDialog({
  business,
  open,
  onOpenChange,
  defaultDate,
}: {
  business: Business;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: string;
}) {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayIn(business.timezone));
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  const schema = z.object({
    customerName: z.string().trim().min(2, t("cal.err.name")).max(80),
    phone: z.string().trim().max(24).optional(),
    serviceId: z.string().uuid(t("cal.err.service")),
    staffId: z.string().uuid(t("cal.err.staff")),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("cal.err.date")),
    time: z.string().regex(/^\d{2}:\d{2}$/, t("cal.err.time")),
  });

  const { data } = useQuery({
    queryKey: ["appointment-form-data", business.id],
    queryFn: async () => {
      const [{ data: services }, { data: staff }] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, duration_minutes, price_cents")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("staff")
          .select("id, name")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      return { services: services ?? [], staff: staff ?? [] };
    },
  });

  async function save() {
    const parsed = schema.safeParse({ customerName, phone, serviceId, staffId, date, time });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("cal.err.generic"));
      return;
    }
    const service = data?.services.find((s) => s.id === serviceId);
    if (!service) return;

    setBusy(true);
    try {
      const [h, m] = time.split(":").map(Number);
      const startsAt = zonedToUtc(date, (h ?? 0) * 60 + (m ?? 0), business.timezone);
      const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);

      let customerId: string | null = null;
      if (phone.trim()) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("business_id", business.id)
          .eq("phone", phone.trim())
          .maybeSingle();
        if (existing) customerId = existing.id;
      }
      if (!customerId) {
        const { data: created } = await supabase
          .from("customers")
          .insert({
            business_id: business.id,
            name: customerName.trim(),
            phone: phone.trim() || null,
          })
          .select("id")
          .single();
        customerId = created?.id ?? null;
      }

      const { error } = await supabase.from("appointments").insert({
        business_id: business.id,
        service_id: service.id,
        staff_id: staffId,
        customer_id: customerId,
        service_name: service.name,
        customer_name: customerName.trim(),
        customer_phone: phone.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_cents: service.price_cents,
        status: "confirmed",
        notes: notes.trim() || null,
        source: "manual",
      });

      if (error) {
        if (error.code === "23P01") {
          toast.error(t("cal.err.conflict"));
          return;
        }
        throw error;
      }

      toast.success(t("cal.success.created"));
      qc.invalidateQueries();
      onOpenChange(false);
      setCustomerName("");
      setPhone("");
      setNotes("");
    } catch {
      toast.error(t("cal.err.create"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cal.dialog.title")}</DialogTitle>
          <DialogDescription>{t("cal.dialog.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname">{t("cal.field.client")}</Label>
            <Input
              id="cname"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cphone">{t("cal.field.phone")}</Label>
            <Input
              id="cphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={24}
              placeholder="912 345 678"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc">{t("cal.field.service")}</Label>
            <select
              id="svc"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("cal.choose")}</option>
              {data?.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stf">{t("cal.field.staff")}</Label>
            <select
              id="stf"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t("cal.choose")}</option>
              {data?.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adate">{t("cal.field.date")}</Label>
              <Input id="adate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="atime">{t("cal.field.time")}</Label>
              <Input id="atime" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="anotes">{t("cal.field.notes")}</Label>
            <Textarea
              id="anotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>
          <Button className="w-full" onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("cal.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
