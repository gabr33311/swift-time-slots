import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, LoadingRows } from "@/components/ui-bits";
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
import { usePrefs } from "@/lib/prefs";
import { initials } from "@/lib/format";
import { UserRound, Pencil, Trash2, Plus } from "lucide-react";

type StaffRow = {
  id: string;
  name: string;
  specialty: string | null;
  is_active: boolean;
  service_ids: string[];
};

export function TeamPanel() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
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
      toast.error(t("pf.team.err.hasAppointments"));
      return;
    }
    toast.success(t("pf.team.removed"));
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  async function toggleActive(s: StaffRow) {
    await supabase.from("staff").update({ is_active: !s.is_active }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" /> {t("pf.team.add")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          icon={<UserRound className="size-6" />}
          title={t("pf.team.empty.title")}
          description={t("pf.team.empty.desc")}
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
                  {s.specialty ?? `${s.service_ids.length}${t("pf.team.servicesCount")}`}
                </p>
              </div>
              <Switch
                checked={s.is_active}
                onCheckedChange={() => toggleActive(s)}
                aria-label={t("pf.common.active")}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("pf.common.edit")}
                onClick={() => {
                  setEditing(s);
                  setOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={t("pf.common.remove")} onClick={() => remove(s.id)}>
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
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, "pf.team.err.name").max(80),
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
  const { t } = usePrefs();
  const [name, setName] = useState(staff?.name ?? "");
  const [specialty, setSpecialty] = useState(staff?.specialty ?? "");
  const [selected, setSelected] = useState<string[]>(
    staff?.service_ids ?? services.map((s) => s.id),
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = schema.safeParse({ name, specialty });
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "pf.common.checkData"));
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
        await supabase.from("staff_services").insert(
          selected.map((sid) => ({
            staff_id: staffId!,
            service_id: sid,
            business_id: businessId,
          })),
        );
      }
      toast.success(t("pf.team.saved"));
      qc.invalidateQueries({ queryKey: ["team"] });
      onOpenChange(false);
    } catch {
      toast.error(t("pf.common.saveError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{staff ? t("pf.team.editTitle") : t("pf.team.newTitle")}</DialogTitle>
          <DialogDescription>{t("pf.team.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pname" className="font-semibold">
              {t("pf.team.name")}
            </Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pspec" className="font-semibold">
              {t("pf.team.specialty")}
            </Label>
            <Input
              id="pspec"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              maxLength={80}
              placeholder={t("pf.team.specialty.placeholder")}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">{t("pf.team.services")}</Label>
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
            {t("pf.common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
