import { useEffect, useMemo, useState } from "react";
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
import { Check, ChevronsUpDown, Loader2, Plus, Users, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { zonedToUtc, todayIn } from "@/lib/time";
import { invalidateAppointmentData } from "@/lib/appointment-status";
import { canonicalPhone } from "@/lib/phone";
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
import { FormError } from "@/components/ui-bits";

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
  const [search, setSearch] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayIn(business.timezone));
  const [time, setTime] = useState(defaultTime ?? "09:00");
  const [notes, setNotes] = useState("");
  // Errors stay visible inside the form (a toast can be missed behind the dialog).
  const [error, setError] = useState<string | null>(null);

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
      const [{ data: services }, { data: staff }, { data: links }] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, duration_minutes, buffer_minutes, price_cents")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("staff")
          .select("id, name")
          .eq("business_id", business.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("staff_services").select("staff_id, service_id").eq("business_id", business.id),
      ]);
      return { services: services ?? [], staff: staff ?? [], links: links ?? [] };
    },
  });

  // Same rule as the public page: a service nobody is linked to can be done by anyone.
  const staffForService = useMemo(() => {
    if (!data) return [];
    const linked = data.links.filter((l) => l.service_id === serviceId);
    if (!serviceId || linked.length === 0) return data.staff;
    return data.staff.filter((p) => linked.some((l) => l.staff_id === p.id));
  }, [data, serviceId]);

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

  function chooseCustomer(id: string) {
    const customer = customers.find((item) => item.id === id);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setPhone(customer.phone ?? "");
    setSearch("");
    setCustomerPickerOpen(false);
  }

  function addNewCustomer(name: string) {
    setCustomerId(null);
    setCustomerName(name.trim());
    setPhone("");
    setSearch("");
    setCustomerPickerOpen(false);
  }

  function clearCustomer() {
    setCustomerId(null);
    setCustomerName("");
    setPhone("");
  }

  // With a single possible professional there is nothing to pick: select it.
  const onlyStaffId = staffForService.length === 1 ? staffForService[0]?.id ?? null : null;
  useEffect(() => {
    if (onlyStaffId && staffId !== onlyStaffId) setStaffId(onlyStaffId);
    else if (staffId && !staffForService.some((p) => p.id === staffId)) setStaffId("");
  }, [onlyStaffId, staffId, staffForService]);

  async function save() {
    const parsed = schema.safeParse({ customerName, phone, serviceId, staffId, date, time });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("cal.err.generic"));
      return;
    }
    const service = data?.services.find((s) => s.id === serviceId);
    if (!service) {
      setError(t("cal.err.service"));
      return;
    }

    const [h, m] = time.split(":").map(Number);
    const startsAt = zonedToUtc(date, (h ?? 0) * 60 + (m ?? 0), business.timezone);
    // Never allow a manual booking in the past, even from the admin agenda.
    if (startsAt.getTime() <= Date.now()) {
      setError(t("cal.err.past"));
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // Same span as online bookings: the service plus its buffer.
      const endsAt = new Date(
        startsAt.getTime() + (service.duration_minutes + service.buffer_minutes) * 60000,
      );
      const cleanPhone = phone.trim() ? canonicalPhone(phone) : null;

      let savedCustomerId: string | null = customerId;
      if (!savedCustomerId && cleanPhone) {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("business_id", business.id)
          .eq("phone", cleanPhone)
          .maybeSingle();
        if (existing) savedCustomerId = existing.id;
      }
      if (!savedCustomerId) {
        const { data: created, error: customerError } = await supabase
          .from("customers")
          .insert({
            business_id: business.id,
            name: customerName.trim(),
            phone: cleanPhone,
          })
          .select("id")
          .single();
        if (customerError) {
          setError(t("cal.err.customer"));
          return;
        }
        savedCustomerId = created.id;
      }

      const { error } = await supabase.from("appointments").insert({
        business_id: business.id,
        service_id: service.id,
        staff_id: staffId,
        customer_id: savedCustomerId,
        service_name: service.name,
        customer_name: customerName.trim(),
        customer_phone: cleanPhone,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price_cents: service.price_cents,
        status: "confirmed",
        notes: notes.trim() || null,
        source: "manual",
      });

      if (error) {
        if (error.code === "23P01") {
          setError(t("cal.err.conflict"));
          return;
        }
        throw error;
      }

      toast.success(t("cal.success.created"));
      void invalidateAppointmentData(qc);
      onOpenChange(false);
      setCustomerName("");
      setPhone("");
      setCustomerId(null);
      setNotes("");
    } catch {
      setError(t("cal.err.create"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        if (!o) setError(null);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cal.dialog.title")}</DialogTitle>
          <DialogDescription>{t("cal.dialog.desc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* One field for the client: search the existing ones or add a new name. */}
          <div className="space-y-1.5">
            <Label>{t("cal.field.client")}</Label>
            <div className="flex items-center gap-2">
              <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={customerPickerOpen}
                    className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3.5 text-left text-base transition-colors hover:bg-muted/40 md:text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Users className="size-4 shrink-0 text-muted-foreground" />
                      <span className={cn("truncate", !customerName && "text-muted-foreground")}>
                        {customerName || t("cal.customer.pick")}
                      </span>
                      {customerName && !customerId && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                          {t("cal.customer.new")}
                        </span>
                      )}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput
                      placeholder={t("cal.customer.search")}
                      value={search}
                      onValueChange={setSearch}
                    />
                    <CommandList>
                      {search.trim().length >= 2 && (
                        <CommandGroup>
                          <CommandItem
                            value={`__new__ ${search}`}
                            onSelect={() => addNewCustomer(search)}
                            className="py-2.5 font-bold"
                          >
                            <Plus className="size-4" />
                            {t("cal.customer.add").replace("{name}", search.trim())}
                          </CommandItem>
                        </CommandGroup>
                      )}
                      {search.trim().length < 2 && <CommandEmpty>{t("cal.customer.empty")}</CommandEmpty>}
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
              {customerName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearCustomer}
                  aria-label={t("cal.customer.clear")}
                  title={t("cal.customer.clear")}
                  className="shrink-0"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
          {customerName && !customerId && (
            <div className="space-y-1.5 animate-enter">
              <Label htmlFor="cphone">{t("cal.field.phone")}</Label>
              <Input
                id="cphone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={24}
                placeholder="912 345 678"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="svc">{t("cal.field.service")}</Label>
            <select
              id="svc"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-base transition-colors focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 md:text-sm"
            >
              <option value="">{t("cal.choose")}</option>
              {data?.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.duration_minutes} min · {formatPrice(s.price_cents, business.currency)}
                </option>
              ))}
            </select>
          </div>
          {/* Only ask for the professional when there is a real choice. */}
          {staffForService.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="stf">{t("cal.field.staff")}</Label>
              <select
                id="stf"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-base transition-colors focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 md:text-sm"
              >
                <option value="">{t("cal.choose")}</option>
                {staffForService.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
          {data && (data.services.length === 0 || data.staff.length === 0) && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
              {t("cal.err.setupMissing")}
            </p>
          )}
        </div>
        {/* Pinned footer: the error and the save button stay in view on small screens. */}
        <div className="sticky -bottom-5 -mx-5 -mb-5 space-y-2 border-t border-border bg-background px-5 pb-5 pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
          <FormError message={error} />
          <Button className="w-full" onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("cal.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
