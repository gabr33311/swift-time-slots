import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMyBusiness } from "@/hooks/use-business";


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Definições — Marca" },
      { name: "description", content: "Dados do negócio, contactos e regras de cancelamento." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Indica o nome do negócio.").max(80),
  description: z.string().trim().max(300),
  phone: z.string().trim().max(24),
  address: z.string().trim().max(160),
  city: z.string().trim().max(80),
  cancellationHours: z.number().int().min(0).max(168),
  slotInterval: z.number().int().min(5).max(120),
});

function SettingsPage() {
  const { business } = useMyBusiness();

  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    phone: "",
    address: "",
    city: "",
    cancellationHours: "24",
    slotInterval: "15",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!business) return;
    setForm({
      name: business.name,
      description: business.description ?? "",
      phone: business.phone ?? "",
      address: business.address ?? "",
      city: business.city ?? "",
      cancellationHours: String(business.cancellation_hours),
      slotInterval: String(business.slot_interval_minutes),
    });
  }, [business]);

  async function save() {
    const parsed = schema.safeParse({
      ...form,
      cancellationHours: Number(form.cancellationHours),
      slotInterval: Number(form.slotInterval),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifica os dados.");
      return;
    }
    if (!business) return;
    setBusy(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        name: parsed.data.name,
        description: parsed.data.description || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        city: parsed.data.city || null,
        cancellation_hours: parsed.data.cancellationHours,
        slot_interval_minutes: parsed.data.slotInterval,
      })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível guardar.");
      return;
    }
    toast.success("Definições guardadas.");
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AppShell>
      <PageHeader title="Definições" subtitle="Os dados do teu negócio." />

      <section className="surface space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="bn">Nome</Label>
          <Input id="bn" value={form.name} onChange={set("name")} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bd">Descrição</Label>
          <Textarea id="bd" value={form.description} onChange={set("description")} maxLength={300} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bp">Telefone</Label>
            <Input id="bp" value={form.phone} onChange={set("phone")} maxLength={24} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bc">Cidade</Label>
            <Input id="bc" value={form.city} onChange={set("city")} maxLength={80} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ba">Morada</Label>
          <Input id="ba" value={form.address} onChange={set("address")} maxLength={160} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bch">Cancelamento até (horas antes)</Label>
            <Input
              id="bch"
              inputMode="numeric"
              value={form.cancellationHours}
              onChange={set("cancellationHours")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bsi">Intervalo entre horários (min)</Label>
            <Input
              id="bsi"
              inputMode="numeric"
              value={form.slotInterval}
              onChange={set("slotInterval")}
            />
          </div>
        </div>
        <Button onClick={save} disabled={busy}>
          Guardar alterações
        </Button>
      </section>

      <section className="surface mt-6 flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium">Terminar sessão</p>
          <p className="text-sm text-muted-foreground">Sai da tua conta neste dispositivo.</p>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Sair
        </Button>
      </section>
    </AppShell>
  );
}
