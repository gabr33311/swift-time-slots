import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { SaveBar } from "@/components/save-bar";
import { LocationPicker } from "@/components/location-picker";

const schema = z.object({
  name: z.string().trim().min(2, "pf.biz.err.name").max(80),
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
  lat: null as number | null,
  lng: null as number | null,
};

function baseline(b: NonNullable<ReturnType<typeof useMyBusiness>["business"]>) {
  return {
    name: b.name,
    description: b.description ?? "",
    phone: b.phone ?? "",
    instagram: b.instagram ?? "",
    address: b.address ?? "",
    city: b.city ?? "",
    cancellationHours: String(b.cancellation_hours),
    slotInterval: String(b.slot_interval_minutes),
    lat: b.latitude ?? null,
    lng: b.longitude ?? null,
  };
}

export function BusinessPanel() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  // Remounts the map after "cancel", so the pin goes back too.
  const [mapKey, setMapKey] = useState(0);

  function hydrate() {
    if (!business) return;
    setForm(baseline(business));
  }

  useEffect(hydrate, [business]);

  async function save() {
    const parsed = schema.safeParse({
      ...form,
      cancellationHours: Number(form.cancellationHours),
      slotInterval: Number(form.slotInterval),
    });
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "pf.common.checkData"));
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
        // Only sent when moved, so saving works even before the columns exist.
        ...(form.lat !== (business.latitude ?? null) || form.lng !== (business.longitude ?? null)
          ? { latitude: form.lat, longitude: form.lng }
          : {}),
      })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    toast.success(t("pf.biz.saved"));
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const dirty = !!business && JSON.stringify(form) !== JSON.stringify(baseline(business));

  return (
    <section className="surface space-y-5 p-5">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bn" className="font-semibold">
            {t("pf.biz.name")}
          </Label>
          <Input id="bn" value={form.name} onChange={set("name")} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bd" className="font-semibold">
            {t("pf.biz.description")}
          </Label>
          <Textarea
            id="bd"
            value={form.description}
            onChange={set("description")}
            maxLength={300}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bp" className="font-semibold">
              {t("pf.biz.phone")}{" "}
              <span className="font-normal text-muted-foreground">{t("pf.biz.recommended")}</span>
            </Label>
            <Input id="bp" value={form.phone} onChange={set("phone")} maxLength={24} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bi" className="font-semibold">
              Instagram{" "}
              <span className="font-normal text-muted-foreground">{t("pf.biz.optional")}</span>
            </Label>
            <Input
              id="bi"
              value={form.instagram}
              onChange={set("instagram")}
              maxLength={60}
              placeholder="@onome"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bc" className="font-semibold">
              {t("pf.biz.city")}
            </Label>
            <Input id="bc" value={form.city} onChange={set("city")} maxLength={80} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ba" className="font-semibold">
              {t("pf.biz.address")}
            </Label>
            <Input id="ba" value={form.address} onChange={set("address")} maxLength={160} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="font-semibold">{t("loc.title")}</Label>
          <LocationPicker
            key={mapKey}
            value={form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : null}
            onChange={(v) => setForm((f) => ({ ...f, lat: v.lat, lng: v.lng }))}
            onAddress={(address, city) =>
              setForm((f) => ({
                ...f,
                address: f.address || address || "",
                city: f.city || city || "",
              }))
            }
            initialQuery={[form.address, form.city].filter(Boolean).join(", ")}
          />
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={() => void save()}
        onCancel={() => {
          if (!business) return;
          setForm(baseline(business));
          setMapKey((k) => k + 1);
        }}
      />
    </section>
  );
}
