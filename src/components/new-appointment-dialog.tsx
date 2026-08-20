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

const schema = z.object({
  customerName: z.string().trim().min(2, "Indica o nome do cliente.").max(80),
  phone: z.string().trim().max(24).optional(),
  serviceId: z.string().uuid("Escolhe um serviço."),
  staffId: z.string().uuid("Escolhe um profissional."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Escolhe uma data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Escolhe uma hora."),
});

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
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayIn(business.timezone));
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");

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
      toast.error(parsed.error.issues[0]?.message ?? "Verifica os dados.");
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
          toast.error("Este horário já está ocupado para esse profissional.");
          return;
        }
        throw error;
      }

      toast.success("Marcação criada.");
      qc.invalidateQueries();
      onOpenChange(false);
      setCustomerName("");
      setPhone("");
      setNotes("");
    } catch {
      toast.error("Não foi possível criar a marcação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova marcação</DialogTitle>
          <DialogDescription>Para clientes que ligaram ou apareceram na loja.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Cliente</Label>
            <Input
              id="cname"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cphone">Telemóvel</Label>
            <Input
              id="cphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={24}
              placeholder="912 345 678"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="svc">Serviço</Label>
            <select
              id="svc"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Escolher…</option>
              {data?.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stf">Profissional</Label>
            <select
              id="stf"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Escolher…</option>
              {data?.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adate">Data</Label>
              <Input id="adate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="atime">Hora</Label>
              <Input id="atime" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="anotes">Notas</Label>
            <Textarea
              id="anotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>
          <Button className="w-full" onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Guardar marcação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
