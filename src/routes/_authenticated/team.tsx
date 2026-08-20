import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMyBusiness } from "@/hooks/use-business";
import { initials } from "@/lib/format";
import { UserRound, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Equipa — Marca" },
      { name: "description", content: "Gere os profissionais e os serviços que cada um faz." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

type StaffRow = {
  id: string;
  name: string;
  specialty: string | null;
  is_active: boolean;
  service_ids: string[];
};

function TeamPage() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["team", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const [{ data: staff }, { data: services }, { data: links }] = await Promise.all([
        supabase
          .from("staff")
          .select("id, name, specialty, is_active")
          .eq("business_id", business!.id)
          .order("sort_order"),
        supabase
          .from("services")
          .select("id, name")
          .eq("business_id", business!.id)
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("staff_services").select("staff_id, service_id"),
      ]);
      const rows: StaffRow[] = (staff ?? []).map((s) => ({
        ...s,
        service_ids: (links ?? []).filter((l) => l.staff_id === s.id).map((l) => l.service_id),
      }));
      return { rows, services: services ?? [] };
    },
  });

  async function remove(id: string) {
    const { error } = await supabase.from("staff").delete().eq("id", id);
    if (error) {
      toast.error("Este profissional tem marcações. Desactiva-o em vez de o apagar.");
      return;
    }
    toast.success("Profissional removido.");
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function toggleActive(s: StaffRow) {
    await supabase.from("staff").update({ is_active: !s.is_active }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <AppShell>
      <PageHeader
        title="Equipa"
        subtitle="Quem atende os clientes."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Adicionar profissional
          </Button>
        }
      />

      {isLoading ? (
        <LoadingRows />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          icon={<UserRound className="size-6" />}
          title="Ainda sem equipa."
          description="Adiciona-te a ti ou aos teus colegas para começar."
        />
      ) : (
        <ul className="space-y-2">
          {data!.rows.map((s) => (
            <li key={s.id} className="surface flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {initials(s.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {s.specialty ?? `${s.service_ids.length} serviços`}
                </p>
              </div>
              <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} aria-label="Activo" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar"
                onClick={() => {
                  setEditing(s);
                  setOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => remove(s.id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <StaffDialog
        key={editing?.id ?? "new"}
        businessId={business?.id}
        staff={editing}
        services={data?.services ?? []}
        open={open}
        onOpenChange={setOpen}
      />
    </AppShell>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, "Indica o nome.").max(80),
  specialty: z.string().trim().max(80),
});

function StaffDialog({
  businessId,
  staff,
  services,
  open,
  onOpenChange,
}: {
  businessId: string | undefined;
  staff: StaffRow | null;
  services: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(staff?.name ?? "");
  const [specialty, setSpecialty] = useState(staff?.specialty ?? "");
  const [selected, setSelected] = useState<string[]>(staff?.service_ids ?? services.map((s) => s.id));
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = schema.safeParse({ name, specialty });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifica os dados.");
      return;
    }
    if (!businessId) return;
    setBusy(true);
    try {
      const payload = {
        business_id: businessId,
        name: parsed.data.name,
        specialty: parsed.data.specialty || null,
      };
      let staffId = staff?.id;
      if (staffId) {
        await supabase.from("staff").update(payload).eq("id", staffId);
      } else {
        const { data: created, error } = await supabase
          .from("staff")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        staffId = created.id;
      }
      await supabase.from("staff_services").delete().eq("staff_id", staffId!);
      if (selected.length) {
        await supabase
          .from("staff_services")
          .insert(selected.map((sid) => ({ staff_id: staffId!, service_id: sid })));
      }
      toast.success("Profissional guardado.");
      qc.invalidateQueries({ queryKey: ["team"] });
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{staff ? "Editar profissional" : "Novo profissional"}</DialogTitle>
          <DialogDescription>Escolhe que serviços esta pessoa faz.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname">Nome</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pspec">Especialidade</Label>
            <Input
              id="pspec"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Cortes e barba"
            />
          </div>
          <div className="space-y-2">
            <Label>Serviços</Label>
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                  }
                />
                {s.name}
              </label>
            ))}
          </div>
          <Button className="w-full" onClick={save} disabled={busy}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
