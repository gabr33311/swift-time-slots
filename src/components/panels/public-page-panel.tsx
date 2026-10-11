import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { effectiveBrand } from "@/lib/brand";
import { ColorSwatches } from "@/components/color-swatches";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { usePrefs } from "@/lib/prefs";
import { ArrowUp, ArrowDown, ImagePlus, Trash2 } from "lucide-react";
import { SaveBar } from "@/components/save-bar";
import { PagePreview } from "@/components/page-preview";
import { ImageCropDialog } from "@/components/image-crop-dialog";

type ImageKind = "logo" | "cover";

export function PublicPagePanel() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const edit = true;
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<ImageKind | null>(null);
  // A picked picture waits here until the owner frames it.
  const [cropping, setCropping] = useState<{ kind: ImageKind; file: File } | null>(null);
  const [showTeam, setShowTeam] = useState(true);
  const [showContacts, setShowContacts] = useState(true);
  const [brandColor, setBrandColor] = useState(effectiveBrand(null));
  const logoUrl = useLogoUrl(business?.logo_url);
  const coverUrl = useLogoUrl(business?.cover_url);

  function hydrate() {
    if (!business) return;
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

  /** Images save right away: there is nothing to undo while picking a file. */
  async function setImage(kind: ImageKind, file: File | null) {
    if (!business) return;
    let path: string | null = null;
    if (file) {
      setUploading(kind);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      path = `${business.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("business-logos")
        .upload(path, file, { upsert: true });
      if (upErr) {
        setUploading(null);
        toast.error(t("pf.biz.err.upload"));
        return;
      }
    }
    setUploading(kind);
    const { error } = await supabase
      .from("businesses")
      .update(kind === "logo" ? { logo_url: path } : { cover_url: path })
      .eq("id", business.id);
    setUploading(null);
    if (error) {
      toast.error(t("pf.biz.err.savePhoto"));
      return;
    }
    toast.success(t("pf.pub.saved"));
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  function pick(kind: ImageKind, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(t("pf.biz.err.imageType"));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error(t("pf.biz.err.imageSize"));
      return;
    }
    setCropping({ kind, file });
  }

  async function save() {
    if (!business) return;
    setBusy(true);
    const { error } = await supabase
      .from("businesses")
      .update({
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
    (showTeam !== business.show_team ||
      showContacts !== business.show_contacts ||
      brandColor !== effectiveBrand(business.brand_color));

  return (
    <div className="space-y-4">
      {/* How clients see the business: banner, logo and colour, with a live preview. */}
      <section className="surface grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-bold">{t("pf.look.title")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("pf.look.desc")}</p>
          </div>

          <ImageRow
            title={t("pf.look.cover")}
            hint={t("pf.look.cover.hint")}
            has={!!business?.cover_url}
            busy={uploading === "cover"}
            onPick={(f) => pick("cover", f)}
            onRemove={() => void setImage("cover", null)}
          />
          <ImageRow
            title={t("pf.look.logo")}
            hint={t("pf.look.logo.hint")}
            has={!!business?.logo_url}
            busy={uploading === "logo"}
            onPick={(f) => pick("logo", f)}
            onRemove={() => void setImage("logo", null)}
          />

          <div className="space-y-2.5">
            <div>
              <p className="text-sm font-bold">{t("pf.brand.title")}</p>
              <p className="text-sm text-muted-foreground">{t("pf.brand.desc")}</p>
            </div>
            <ColorSwatches
              value={brandColor}
              onChange={setBrandColor}
              label={t("pf.brand.title")}
            />
          </div>
        </div>

        <div className="md:sticky md:top-24">
          <PagePreview
            name={business?.name ?? ""}
            brand={brandColor}
            logoUrl={logoUrl}
            coverUrl={coverUrl}
          />
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

      <ImageCropDialog
        file={cropping?.file ?? null}
        shape={cropping?.kind ?? "logo"}
        onCancel={() => setCropping(null)}
        onDone={async (f) => {
          if (!cropping) return;
          await setImage(cropping.kind, f);
          setCropping(null);
        }}
      />

      <SaveBar dirty={dirty} busy={busy} onSave={() => void save()} onCancel={hydrate} />
    </div>
  );
}

function ImageRow({
  title,
  hint,
  has,
  busy,
  onPick,
  onRemove,
}: {
  title: string;
  hint: string;
  has: boolean;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const { t } = usePrefs();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <div className="flex gap-2">
        {has && (
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={onRemove}
            aria-label={t("pf.look.remove")}
          >
            <Trash2 />
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
          <ImagePlus /> {has ? t("pf.look.change") : t("pf.look.upload")}
        </Button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
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
