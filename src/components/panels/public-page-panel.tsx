import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { initials } from "@/lib/format";
import { Pencil, Save, X, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";

export function PublicPagePanel() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [showTeam, setShowTeam] = useState(true);
  const [showContacts, setShowContacts] = useState(true);
  const logoUrl = useLogoUrl(business?.logo_url);

  function hydrate() {
    if (!business) return;
    setDescription(business.description ?? "");
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
