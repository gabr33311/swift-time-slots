import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { initials } from "@/lib/format";
import { Pencil, Save, X, ImagePlus } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(2, "Indica o nome do negócio.").max(80),
  description: z.string().trim().max(300),
  phone: z.string().trim().max(24),
  instagram: z.string().trim().max(60),
  address: z.string().trim().max(160),
  city: z.string().trim().max(80),
  cancellationHours: z.number().int().min(0).max(168),
  slotInterval: z.number().int().min(5).max(120),
});

const EMPTY = {
  name: "",
  description: "",
  phone: "",
  instagram: "",
  address: "",
  city: "",
  cancellationHours: "24",
  slotInterval: "15",
};

export function BusinessPanel() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoUrl = useLogoUrl(business?.logo_url);

  function hydrate() {
    if (!business) return;
    setForm({
      name: business.name,
      description: business.description ?? "",
      phone: business.phone ?? "",
      instagram: business.instagram ?? "",
      address: business.address ?? "",
      city: business.city ?? "",
      cancellationHours: String(business.cancellation_hours),
      slotInterval: String(business.slot_interval_minutes),
    });
  }

  useEffect(hydrate, [business]);

  async function uploadLogo(file: File) {
    if (!business) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolhe um ficheiro de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem tem de ter menos de 5 MB.");
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${business.id}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("business-logos")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setBusy(false);
      toast.error("Não foi possível enviar a foto.");
      return;
    }
    const { error } = await supabase
      .from("businesses")
      .update({ logo_url: path })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível guardar a foto.");
      return;
    }
    toast.success("Foto actualizada.");
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

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
        instagram: parsed.data.instagram || null,
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
    setEdit(false);
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="surface space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="relative">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Foto de ${business?.name ?? "perfil"}`}
                className="size-16 rounded-2xl object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
                {business ? initials(business.name) : "S"}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Foto de perfil</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="mr-2 size-4" /> Carregar foto
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {edit ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                hydrate();
                setEdit(false);
              }}
            >
              <X className="mr-2 size-4" /> Cancelar alterações
            </Button>
            <Button size="sm" onClick={save} disabled={busy}>
              <Save className="mr-2 size-4" /> Guardar
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            <Pencil className="mr-2 size-4" /> Editar
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bn" className="font-semibold">
            Nome
          </Label>
          <Input id="bn" value={form.name} onChange={set("name")} maxLength={80} disabled={!edit} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bd" className="font-semibold">
            Descrição
          </Label>
          <Textarea
            id="bd"
            value={form.description}
            onChange={set("description")}
            maxLength={300}
            disabled={!edit}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bp" className="font-semibold">
              Telemóvel <span className="font-normal text-muted-foreground">(recomendado)</span>
            </Label>
            <Input id="bp" value={form.phone} onChange={set("phone")} maxLength={24} disabled={!edit} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bi" className="font-semibold">
              Instagram <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="bi"
              value={form.instagram}
              onChange={set("instagram")}
              maxLength={60}
              disabled={!edit}
              placeholder="@onome"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bc" className="font-semibold">
              Cidade
            </Label>
            <Input id="bc" value={form.city} onChange={set("city")} maxLength={80} disabled={!edit} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ba" className="font-semibold">
              Morada
            </Label>
            <Input
              id="ba"
              value={form.address}
              onChange={set("address")}
              maxLength={160}
              disabled={!edit}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bch" className="font-semibold">
              Cancelamento até (horas antes)
            </Label>
            <Input
              id="bch"
              inputMode="numeric"
              value={form.cancellationHours}
              onChange={set("cancellationHours")}
              disabled={!edit}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bsi" className="font-semibold">
              Intervalo entre horários (min)
            </Label>
            <Input
              id="bsi"
              inputMode="numeric"
              value={form.slotInterval}
              onChange={set("slotInterval")}
              disabled={!edit}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
