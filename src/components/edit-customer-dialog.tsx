import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrefs } from "@/lib/prefs";
import { formatPrice } from "@/lib/format";

export type EditableCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

/** Edit a customer's name, contacts, record notes and review their history. */
export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
  businessId,
  mode = "edit",
}: {
  customer: EditableCustomer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When set and no customer is given, the dialog creates a new customer. */
  businessId?: string | undefined;
  mode?: "edit" | "history";
}) {
  const qc = useQueryClient();
  const { lang, t } = usePrefs();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(customer?.name ?? "");
    setPhone(customer?.phone ?? "");
    setEmail(customer?.email ?? "");
    setNotes(customer?.notes ?? "");
  }, [customer]);

  const { data: history } = useQuery({
    queryKey: ["customer-history", customer?.id],
    enabled: !!customer && open,
    queryFn: async () => {
      if (!customer) return [];
      let query = supabase
        .from("appointments")
        .select("id, starts_at, service_name, price_cents, status")
        .eq("customer_id", customer.id)
        .order("starts_at", { ascending: false })
        .limit(20);
      if (mode === "history") query = query.eq("status", "completed");
      const { data } = await query;
      return data ?? [];
    },
  });

  const spent = (history ?? [])
    .filter((a) => a.status === "completed")
    .reduce((s, a) => s + a.price_cents, 0);

  async function save() {
    if (!customer && !businessId) return;
    if (!name.trim()) {
      toast.error(t("cust.toast.nameRequired"));
      return;
    }
    setBusy(true);
    const payload = {
      name: name.trim().slice(0, 80),
      phone: phone.trim() ? phone.trim().slice(0, 30) : null,
      email: email.trim() ? email.trim().slice(0, 120) : null,
      notes: notes.trim() ? notes.trim().slice(0, 500) : null,
    };
    let error: { message: string } | null;
    if (customer) {
      ({ error } = await supabase.from("customers").update(payload).eq("id", customer.id));
    } else if (businessId) {
      ({ error } = await supabase.from("customers").insert({ ...payload, business_id: businessId }));
    } else {
      setBusy(false);
      return;
    }
    setBusy(false);
    if (error) {
      toast.error(t("cust.toast.saveError"));
      return;
    }
    toast.success(customer ? t("cust.toast.updated") : t("cust.toast.created"));
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "history"
              ? `${t("cust.history.title")} · ${customer?.name ?? ""}`
              : customer
                ? t("cust.dialog.editTitle")
                : t("cust.dialog.newTitle")}
          </DialogTitle>
          {mode === "edit" && <DialogDescription>{t("cust.dialog.desc")}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          {mode === "edit" && (
            <>
          <div className="space-y-1.5">
            <Label htmlFor="cname" className="font-bold">
              {t("cust.field.name")}
            </Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cphone" className="font-bold">
                {t("cust.field.phone")}
              </Label>
              <Input
                id="cphone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cemail" className="font-bold">
                {t("cust.field.email")}
              </Label>
              <Input
                id="cemail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cnotes" className="font-bold">
              {t("cust.field.notes")}
            </Label>
            <Textarea
              id="cnotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder={t("cust.field.notes.placeholder")}
            />
          </div>
            </>
          )}

          {customer && (
            <section className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{t("cust.history.title")}</h3>
                <span className="text-xs font-bold tabular-nums text-muted-foreground">
                  {t("cust.history.total")}: {formatPrice(spent, "EUR")}
                </span>
              </div>
              {(history ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t("cust.history.empty")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(history ?? []).map((a) => (
                    <li
                      key={a.id}
                      data-status={a.status}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="tabular-nums text-muted-foreground">
                        {new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-PT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        }).format(new Date(a.starts_at))}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{a.service_name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatPrice(a.price_cents, "EUR")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {mode === "edit" && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("cust.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {t("cust.save")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
