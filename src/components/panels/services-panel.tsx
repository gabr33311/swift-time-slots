import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, LoadingRows } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { formatDuration, formatPrice } from "@/lib/format";
import { Scissors, Pencil, Trash2, Plus, GripVertical } from "lucide-react";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
  requires_confirmation: boolean;
};

const schema = z.object({
  name: z.string().trim().min(2, "pf.svc.err.name").max(80),
  price: z.number().min(0, "pf.svc.err.price").max(100000),
  duration: z.number().int().min(5, "pf.svc.err.duration").max(600),
  buffer: z.number().int().min(0).max(120),
  description: z.string().trim().max(300),
});

export function ServicesPanel() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["services", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select(
          "id, name, description, price_cents, duration_minutes, buffer_minutes, is_active, requires_confirmation",
        )
        .eq("business_id", business!.id)
        .order("sort_order");
      return (data ?? []) as ServiceRow[];
    },
  });

  async function toggleActive(s: ServiceRow) {
    await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  async function reorder(targetId: string) {
    const list = data ?? [];
    if (!dragId || dragId === targetId) return;
    const from = list.findIndex((s) => s.id === dragId);
    const to = list.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    qc.setQueryData(["services", business?.id], next);
    await Promise.all(
      next.map((s, i) => supabase.from("services").update({ sort_order: i }).eq("id", s.id)),
    );
    qc.invalidateQueries({ queryKey: ["services"] });
  }

  async function remove(s: ServiceRow) {
    const { error } = await supabase.from("services").delete().eq("id", s.id);
    if (error) {
      toast.error(t("pf.svc.err.hasAppointments"));
      return;
    }
    toast.success(t("pf.svc.removed"));
    qc.invalidateQueries({ queryKey: ["services"] });
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
          <Plus className="mr-2 size-4" /> {t("pf.svc.new")}
        </Button>
      </div>

      {isLoading ? (
        <LoadingRows />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Scissors className="size-6" />}
          title={t("pf.svc.empty.title")}
          description={t("pf.svc.empty.desc")}
        />
      ) : (
        <ul className="space-y-2">
          {data!.map((s) => (
            <li
              key={s.id}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                reorder(s.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className="surface flex flex-wrap items-center gap-3 p-4"
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {formatDuration(s.duration_minutes)} ·{" "}
                  {formatPrice(s.price_cents, business!.currency)}
                  {s.buffer_minutes ? ` · +${s.buffer_minutes}${t("pf.svc.bufferSuffix")}` : ""}
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
              <Button variant="ghost" size="icon" aria-label={t("pf.common.remove")} onClick={() => remove(s)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ServiceDialog
        key={editing?.id ?? "new"}
        businessId={business?.id}
        service={editing}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}

function ServiceDialog({
  businessId,
  service,
  open,
  onOpenChange,
}: {
  businessId: string | undefined;
  service: ServiceRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { t } = usePrefs();
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [price, setPrice] = useState(String((service?.price_cents ?? 0) / 100));
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 30));
  const [buffer, setBuffer] = useState(String(service?.buffer_minutes ?? 0));
  const [requiresConfirmation, setRequiresConfirmation] = useState(
    service?.requires_confirmation ?? false,
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = schema.safeParse({
      name,
      description,
      price: Number(price.replace(",", ".")),
      duration: Number(duration),
      buffer: Number(buffer),
    });
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "pf.common.checkData"));
      return;
    }
    if (!businessId) return;
    setBusy(true);
    const payload = {
      business_id: businessId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price_cents: Math.round(parsed.data.price * 100),
      duration_minutes: parsed.data.duration,
      buffer_minutes: parsed.data.buffer,
      requires_confirmation: requiresConfirmation,
    };
    const { error } = service
      ? await supabase.from("services").update(payload).eq("id", service.id)
      : await supabase.from("services").insert(payload);
    setBusy(false);
    if (error) {
      toast.error(t("pf.svc.err.save"));
      return;
    }
    toast.success(t("pf.svc.saved"));
    qc.invalidateQueries({ queryKey: ["services"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? t("pf.svc.editTitle") : t("pf.svc.new")}</DialogTitle>
          <DialogDescription>{t("pf.svc.dialogDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sname" className="font-semibold">
              {t("pf.svc.name")}
            </Label>
            <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sdesc" className="font-semibold">
              {t("pf.svc.description")}
            </Label>
            <Textarea
              id="sdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sprice" className="font-semibold">
                {t("pf.svc.price")}
              </Label>
              <Input
                id="sprice"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sdur" className="font-semibold">
                {t("pf.svc.duration")}
              </Label>
              <Input
                id="sdur"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sbuf" className="font-semibold">
                {t("pf.svc.buffer")}
              </Label>
              <Input
                id="sbuf"
                inputMode="numeric"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">{t("pf.svc.requiresConfirmation")}</p>
              <p className="text-xs text-muted-foreground">
                {t("pf.svc.requiresConfirmation.desc")}
              </p>
            </div>
            <Switch checked={requiresConfirmation} onCheckedChange={setRequiresConfirmation} />
          </div>
          <Button className="w-full" onClick={save} disabled={busy}>
            {t("pf.common.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
