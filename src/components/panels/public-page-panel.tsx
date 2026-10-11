import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type CSSProperties } from "react";
import { BRAND_PALETTE, brandColors, effectiveBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { ArrowUp, ArrowDown, Check } from "lucide-react";
import { SaveBar } from "@/components/save-bar";

export function PublicPagePanel() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const edit = true;
  const [busy, setBusy] = useState(false);
  const [description, setDescription] = useState("");
  const [showTeam, setShowTeam] = useState(true);
  const [showContacts, setShowContacts] = useState(true);
  const [brandColor, setBrandColor] = useState(effectiveBrand(null));

  function hydrate() {
    if (!business) return;
    setDescription(business.description ?? "");
    setShowTeam(business.show_team);
    setShowContacts(business.show_contacts);
    setBrandColor(effectiveBrand(business.brand_color));
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
      supabase
        .from("services")
        .update({ sort_order: index + dir })
        .eq("id", current.id),
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
        brand_color: brandColor,
      })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    toast.success(t("pf.pub.saved"));
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  const dirty =
    !!business &&
    (description !== (business.description ?? "") ||
      showTeam !== business.show_team ||
      showContacts !== business.show_contacts ||
      brandColor !== effectiveBrand(business.brand_color));

  return (
    <div className="space-y-4">
      {/* The business colour: used on the public page and to tint the app. */}
      <section className="surface space-y-4 p-5">
        <div>
          <h2 className="text-sm font-bold">{t("pf.brand.title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("pf.brand.desc")}</p>
        </div>
        <div role="radiogroup" aria-label={t("pf.brand.title")} className="flex flex-wrap gap-2.5">
          {BRAND_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={brandColor === c}
              aria-label={c}
              onClick={() => setBrandColor(c)}
              className={cn(
                "flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform active:scale-95",
                brandColor === c ? "ring-2 ring-foreground" : "hover:scale-105",
              )}
              style={{ backgroundColor: c }}
            >
              {brandColor === c && (
                <Check
                  className="size-5"
                  strokeWidth={3}
                  style={{ color: brandColors(c).foreground }}
                />
              )}
            </button>
          ))}
        </div>
        {/* Live preview of how clients will see it. */}
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-4"
          style={
            {
              "--brand": brandColors(brandColor).brand,
              "--brand-foreground": brandColors(brandColor).foreground,
            } as CSSProperties
          }
        >
          <span className="h-1 w-16 rounded-full bg-brand" />
          <span className="flex size-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-foreground">
            13
          </span>
          <span className="rounded-xl border border-brand bg-brand px-3 py-2 text-sm font-bold text-brand-foreground">
            10:30
          </span>
          <Button variant="brand" size="sm" type="button" tabIndex={-1}>
            {t("pf.brand.preview")}
          </Button>
        </div>
      </section>

      <section className="surface space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{t("pf.pub.title")}</h2>
        </div>

        <div className="divide-y divide-border rounded-xl border border-border">
          <ToggleRow
            title={t("pf.pub.showTeam")}
            description={t("pf.pub.showTeam.desc")}
            checked={showTeam}
            disabled={!edit}
            onChange={setShowTeam}
          />
          <ToggleRow
            title={t("pf.pub.showContacts")}
            description={t("pf.pub.contacts.desc")}
            checked={showContacts}
            disabled={!edit}
            onChange={setShowContacts}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-bold">{t("pf.pub.serviceOrder")}</Label>
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
                  aria-label={t("pf.common.up")}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("pf.common.down")}
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

      <SaveBar
        dirty={dirty}
        busy={busy}
        onSave={() => void save()}
        onCancel={() => {
          if (!business) return;
          setDescription(business.description ?? "");
          setShowTeam(business.show_team);
          setShowContacts(business.show_contacts);
          setBrandColor(effectiveBrand(business.brand_color));
        }}
      />
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
