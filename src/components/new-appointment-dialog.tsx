import { useEffect, useState } from "react";
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
import { Check, ChevronsUpDown, Loader2, Users, X } from "lucide-react";
import { zonedToUtc, todayIn } from "@/lib/time";
import type { Business } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export function NewAppointmentDialog({
  business,
  open,
  onOpenChange,
  defaultDate,
  defaultTime,
}: {
  business: Business;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
}) {
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayIn(business.timezone));
  const [time, setTime] = useState(defaultTime ?? "09:00");
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

  const { data: customers = [] } = useQuery({
    queryKey: ["appointment-customers", business.id],
    enabled: open,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("customers")
        .select("id, name, phone, email")
        .eq("business_id", business.id)
        .eq("is_blocked", false)
        .order("name")
        .limit(200);
      if (error) throw error;
      return rows ?? [];
    },
  });

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;

  function chooseCustomer(id: string) {
    const customer = customers.find((item) => item.id === id);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setPhone(customer.phone ?? "");
    setCustomerPickerOpen(false);
  }

  function clearCustomer() {
    setCustomerId(null);
    setCustomerName("");
    setPhone("");
  }

  // With a single active professional there is nothing to pick: select it.
  const onlyStaffId = data?.staff.length === 1 ? data.staff[0]?.id ?? null : null;
  useEffect(() => {
    if (onlyStaffId && !staffId) setStaffId(onlyStaffId);
  }, [onlyStaffId, staffId]);

  async function save() {
    const parsed = schema.safeParse({ customerName, phone, serviceId, staffId, date, time });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("cal.err.generic"));
      return;
    }
    const service = data?.services.find((s) => s.id === serviceId);
    if (!service) return;

    const [h, m] = time.split(":").map(Number);
    const startsAt = zonedToUtc(date, (h ?? 0) * 60 + (m ?? 0), business.timezone);
    // Never allow a manual booking in the past, even from the admin agenda.
    if (startsAt.getTime() <= Date.now()) {
      toast.error(t("cal.err.past"));
      return;
    }

    setBusy(true);
    try {
      const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);

      let savedCustomerId: string | null = customerId;
      if (!savedCustomerId && phone.trim()) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("business_id", business.id)
          .eq("phone", phone.trim())
          .maybeSingle();
        if (existing) savedCustomerId = existing.id;
      }
      if (!savedCustomerId) {
        const { data: created } = await supabase
          .from("customers")
          .insert({
            business_id: business.id,
            name: customerName.trim(),
            phone: phone.trim() || null,
          })
          .select("id")
          .single();
        savedCustomerId = created?.id ?? null;
      }

      const { error } = await supabase.from("appointments").insert({
        business_id: business.id,
        service_id: service.id,
        staff_id: staffId,
        customer_id: savedCustomerId,
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
      setCustomerId(null);
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
            <Label>{t("cal.customer.existing")}</Label>
            <div className="flex items-center gap-2">
              <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-label={t("cal.customer.select")}
                    aria-expanded={customerPickerOpen}
                    className="min-w-0 flex-1 justify-between px-3 font-medium"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Users className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        {selectedCustomer?.name ?? t("cal.customer.select")}
                      </span>
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder={t("cal.customer.search")} />
                    <CommandList>
                      <CommandEmpty>{t("cal.customer.empty")}</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.phone ?? ""} ${customer.email ?? ""}`}
                            onSelect={() => chooseCustomer(customer.id)}
                            className="py-2.5"
                          >
                            <Check
                              className={cn(
                                "size-4",
                                customerId === customer.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold">{customer.name}</p>
                              {(customer.phone || customer.email) && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {customer.phone ?? customer.email}
                                </p>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedCustomer && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearCustomer}
                  aria-label={t("cal.customer.clear")}
                  title={t("cal.customer.clear")}
                  className="size-10 shrink-0"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
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
