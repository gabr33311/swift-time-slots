import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { initials } from "@/lib/format";
import { Pencil, Save, X, ImagePlus, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";

const COLORS = ["#7c3aed", "#4f46e5", "#0ea5e9", "#059669", "#e11d48", "#f59e0b", "#111827"];

export function PublicPagePanel() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [showTeam, setShowTeam] = useState(true);
  const [showContacts, setShowContacts] = useState(true);
  const coverRef = useRef<HTMLInputElement>(null);
  const logoUrl = useLogoUrl(business?.logo_url);
  const coverUrl = useLogoUrl(business?.cover_url ?? null);

  function hydrate() {
    if (!business) return;
    setDescription(business.description ?? "");
    setColor(business.brand_color);
    setShowTeam(business.show_team);
    setShowContacts(business.show_contacts);
  }
  useEffect(hydrate, [business]);

  const { data: services } = useQuery({
    queryKey: ["services-order", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, sort_order")
        .eq("business_id", business!.id)
        .order("sort_order")
        .order("created_at");
      return data ?? [];
    },
  });

  async function uploadCover(file: File) {
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
    const path = `${business.id}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("business-logos")
      .upload(path, file, { upsert: true });
    if (!upErr) {
      await supabase.from("businesses").update({ cover_url: path }).eq("id", business.id);
      qc.invalidateQueries({ queryKey: ["my-business"] });
      toast.success("Imagem de capa actualizada.");
    } else {
      toast.error("Não foi possível enviar a imagem.");
    }
    setBusy(false);
  }

  async function move(index: number, dir: -1 | 1) {
    const list = services ?? [];
    const target = list[index + dir];
    const current = list[index];
    if (!target || !current) return;
    await Promise.all([
      supabase.from("services").update({ sort_order: index + dir }).eq("id", current.id),
      supabase.from("services").update({ sort_order: index }).eq("id", target.id),
    ]);
    qc.invalidateQueries({ queryKey: ["services-order"] });
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  async function save() {
    if (!business) return;
    setBusy(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        description: description.trim() || null,
        brand_color: color,
        show_team: showTeam,
        show_contacts: showContacts,
      })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível guardar.");
      return;
    }
    toast.success("Página actualizada.");
    setEdit(false);
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  const publicUrl =
    typeof window !== "undefined" && business
      ? `${window.location.origin}/book/${business.slug}`
      : "";

  return (
    <div className="space-y-4">
      <section className="surface space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Personalizar página pública</h2>
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
                <X className="mr-2 size-4" /> Cancelar
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

        <div className="space-y-2">
          <Label className="font-bold">Imagem de capa</Label>
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Capa da página pública"
              className="h-32 w-full rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
              Sem imagem de capa
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => coverRef.current?.click()}
          >
            <ImagePlus className="mr-2 size-4" /> Carregar capa
          </Button>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCover(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ppd" className="font-bold">
            Descrição
          </Label>
          <Textarea
            id="ppd"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            disabled={!edit}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-bold">Cor principal</Label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!edit}
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                className={
                  "size-8 rounded-full ring-offset-2 ring-offset-background transition-transform " +
                  (color === c ? "ring-2 ring-foreground" : "hover:scale-105")
                }
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border">
          <ToggleRow
            title="Mostrar equipa"
            description="Apresenta os profissionais na página."
            checked={showTeam}
            disabled={!edit}
            onChange={setShowTeam}
          />
          <ToggleRow
            title="Mostrar contactos"
            description="Morada, telemóvel e Instagram."
            checked={showContacts}
            disabled={!edit}
            onChange={setShowContacts}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-bold">Ordem dos serviços</Label>
          <ul className="space-y-2">
            {(services ?? []).map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{s.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Subir"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Descer"
                  disabled={i === (services?.length ?? 0) - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Pré-visualização</h2>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 size-4" /> Abrir página
            </Button>
          </a>
        </div>

        <div className="mx-auto mt-4 w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-card">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-20 w-full object-cover" />
          ) : (
            <div className="h-20 w-full" style={{ backgroundColor: color }} />
          )}
          <div className="p-4">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="size-full object-cover" />
                ) : (
                  initials(business?.name ?? "S")
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{business?.name}</p>
                {showContacts && business?.city && (
                  <p className="truncate text-xs text-muted-foreground">{business.city}</p>
                )}
              </div>
            </div>
            {description && (
              <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{description}</p>
            )}
            <div className="mt-3 space-y-1.5">
              {(services ?? []).slice(0, 3).map((s) => (
                <div key={s.id} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold">
                  {s.name}
                </div>
              ))}
            </div>
            <div
              className="mt-3 rounded-lg py-2 text-center text-xs font-bold text-white"
              style={{ backgroundColor: color }}
            >
              Marcar
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
