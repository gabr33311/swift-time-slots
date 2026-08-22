import { useQueryClient } from "@tanstack/react-query";
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

export type EditableCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

/** Edit a customer's name, contacts and notes. */
export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: EditableCustomer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
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

  async function save() {
    if (!customer) return;
    if (!name.trim()) {
      toast.error("O nome é obrigatório.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("customers")
      .update({
        name: name.trim().slice(0, 80),
        phone: phone.trim() ? phone.trim().slice(0, 30) : null,
        email: email.trim() ? email.trim().slice(0, 120) : null,
        notes: notes.trim() ? notes.trim().slice(0, 500) : null,
      })
      .eq("id", customer.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível guardar o cliente.");
      return;
    }
    toast.success("Cliente actualizado.");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>Actualiza os dados e as notas deste cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname" className="font-bold">
              Nome *
            </Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cphone" className="font-bold">
                Telemóvel
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
                Email
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
              Notas
            </Label>
            <Textarea
              id="cnotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Preferências, alergias, histórico…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
