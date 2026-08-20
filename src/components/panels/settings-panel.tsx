import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";

export function SettingsPanel() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { theme, setTheme, lang, setLang, t } = usePrefs();

  async function toggle(field: "is_published" | "seo_indexable", value: boolean) {
    if (!business) return;
    setBusy(true);
    const patch = field === "is_published" ? { is_published: value } : { seo_indexable: value };
    const { error } = await supabase.from("businesses").update(patch).eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível guardar.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-business"] });
    toast.success("Guardado.");
  }

  return (
    <section className="surface divide-y divide-border">
      <Row
        title="Página publicada"
        description="Desliga para deixar de aceitar marcações online."
        checked={business?.is_published ?? false}
        disabled={busy}
        onChange={(v) => toggle("is_published", v)}
      />
      <Row
        title="Aparecer no Google"
        description="Permite que motores de busca indexem a tua página."
        checked={business?.seo_indexable ?? false}
        disabled={busy}
        onChange={(v) => toggle("seo_indexable", v)}
      />
      <Row
        title={t("prefs.theme")}
        description={t("prefs.theme.desc")}
        checked={theme === "dark"}
        disabled={false}
        onChange={(v) => setTheme(v ? "dark" : "light")}
      />
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-bold">{t("prefs.lang")}</p>
          <p className="text-sm text-muted-foreground">{t("prefs.lang.desc")}</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["pt", "en"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={
                "rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-colors " +
                (lang === l ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")
              }
            >
              {l === "pt" ? "Português" : "English"}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({
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
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
