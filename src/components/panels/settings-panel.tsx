import { useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Crown, LogOut } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { ColorSwatches } from "@/components/color-swatches";
import { useAppColor } from "@/hooks/use-app-color";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { isLang, LANGS } from "@/lib/prefs-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SettingsPanel() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: undefined, next: undefined }, replace: true });
  }
  const { theme, setTheme, lang, setLang, t } = usePrefs();
  const { color: appColor, setColor: setAppColor } = useAppColor();
  const { access } = useSubscription();
  const planBadge =
    access?.state === "active"
      ? "Pro"
      : access?.state === "trial"
        ? t("sub.menu.trial").replace("{n}", String(access.trialDaysLeft))
        : access?.state === "past_due"
          ? t("sub.status.pastDue")
          : access
            ? t("sub.menu.ended")
            : "";

  async function toggle(field: "is_published" | "seo_indexable", value: boolean) {
    if (!business) return;
    setBusy(true);
    const patch = field === "is_published" ? { is_published: value } : { seo_indexable: value };
    const { error } = await supabase.from("businesses").update(patch).eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-business"] });
    toast.success(t("ui.save.auto"));
  }

  return (
    <section className="surface divide-y divide-border overflow-hidden">
      {/* The plan: gold only on the small badge. */}
      <Link
        to="/plans"
        className="group flex items-center gap-3.5 p-5 transition-colors hover:bg-muted/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
          <Crown className="size-[17px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-bold">{t("sub.menu.title")}</span>
            {planBadge && (
              <span className="whitespace-nowrap rounded-full border border-subscription-accent px-2 py-px text-[10px] font-bold uppercase text-foreground">
                {planBadge}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {access?.subscribed ? t("sub.manage") : t("sub.menu.upgrade")}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
      <Row
        title={t("pf.set.published")}
        description={t("pf.set.published.desc")}
        checked={business?.is_published ?? false}
        disabled={busy}
        onChange={(v) => toggle("is_published", v)}
      />
      <Row
        title={t("pf.set.google")}
        description={t("pf.set.google.desc")}
        checked={business?.seo_indexable ?? false}
        disabled={busy}
        onChange={(v) => toggle("seo_indexable", v)}
      />
      {/* Personal: how the app looks to you. Clients see the page colour instead. */}
      <div className="space-y-3 p-5">
        <div>
          <p className="text-sm font-bold">{t("prefs.appColor")}</p>
          <p className="text-sm text-muted-foreground">{t("prefs.appColor.desc")}</p>
        </div>
        <ColorSwatches
          value={appColor}
          onChange={(c) =>
            void setAppColor(c).then((ok) => !ok && toast.error(t("pf.common.saveError")))
          }
          label={t("prefs.appColor")}
        />
      </div>
      <Row
        title={t("prefs.theme")}
        description={t("prefs.theme.desc")}
        checked={theme === "dark"}
        disabled={false}
        onChange={(v) => setTheme(v ? "dark" : "light")}
      />
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="text-sm font-bold">{t("prefs.lang")}</p>
          <p className="text-sm text-muted-foreground">{t("prefs.lang.desc")}</p>
        </div>
        <Select value={lang} onValueChange={(v) => isLang(v) && setLang(v)}>
          <SelectTrigger aria-label={t("prefs.lang")} className="w-full shrink-0 font-bold sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {LANGS.map((l) => (
              <SelectItem key={l.code} value={l.code} lang={l.locale} className="font-bold">
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex w-full items-center gap-3 p-5 text-left text-sm font-bold text-destructive hover:bg-muted"
      >
        <LogOut className="size-4" /> {t("nav.logout")}
      </button>
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
