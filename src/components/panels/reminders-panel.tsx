import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { brandColors } from "@/lib/brand";

const LEADS = [2, 12, 24, 48];

/** Pro: clients get an email before their appointment, so fewer of them forget. */
export function RemindersPanel() {
  const { business } = useMyBusiness();
  const { t } = usePrefs();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const enabled = business?.reminders_enabled ?? true;
  const hours = business?.reminder_hours ?? 24;
  const page = brandColors(business?.brand_color);

  const { data: sent } = useQuery({
    queryKey: ["reminders-sent", business?.id],
    enabled: !!business,
    queryFn: async () => {
      const { count } = await supabase
        .from("appointment_reminders")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id)
        .eq("kind", "email")
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
      return count ?? 0;
    },
  });

  async function save(patch: { reminders_enabled?: boolean; reminder_hours?: number }) {
    if (!business) return;
    setBusy(true);
    const { error } = await supabase.from("businesses").update(patch).eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error(t("pf.common.saveError"));
      return;
    }
    toast.success(t("ui.save.auto"));
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  return (
    <div className="space-y-4">
      <section className="surface divide-y divide-border">
        <div className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-ink">
              <BellRing className="size-[17px]" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-sm font-bold">
                {t("rm.toggle")}
                <span className="rounded-full border border-subscription-accent px-2 py-px text-[10px] font-bold uppercase">
                  Pro
                </span>
              </p>
              <p className="text-sm text-muted-foreground">{t("rm.toggle.desc")}</p>
            </div>
          </div>
          <Switch
            checked={enabled}
            disabled={busy || !business}
            onCheckedChange={(v) => void save({ reminders_enabled: v })}
            aria-label={t("rm.toggle")}
          />
        </div>

        <div className={cn("space-y-3 p-5", !enabled && "opacity-50")}>
          <p className="text-sm font-bold">{t("rm.when")}</p>
          <div className="grid grid-cols-4 gap-2">
            {LEADS.map((h) => (
              <button
                key={h}
                type="button"
                disabled={!enabled || busy}
                aria-pressed={hours === h}
                onClick={() => void save({ reminder_hours: h })}
                className={cn(
                  "h-11 rounded-xl border text-sm font-bold transition-colors",
                  hours === h
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {h}h
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("rm.when.hint")}</p>
        </div>

        <div className="flex items-center justify-between gap-4 p-5">
          <p className="text-sm text-muted-foreground">{t("rm.sent30")}</p>
          <p className="text-lg font-bold tabular-nums">{sent ?? "—"}</p>
        </div>
      </section>

      {/* What the client receives. */}
      <section className="surface space-y-3 p-5">
        <p className="flex items-center gap-2 text-sm font-bold">
          <Mail className="size-4 text-brand-ink" /> {t("rm.preview")}
        </p>
        <div className="rounded-xl border border-border bg-background p-4 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {business?.name}
          </p>
          <p className="mt-1 text-lg font-bold">{t("rm.preview.title")}</p>
          <p className="mt-1 text-muted-foreground">{t("rm.preview.body")}</p>
          <div className="mt-3 rounded-lg border border-border p-3 text-[13px]">
            <p>
              <b>{t("rm.preview.service")}</b> {t("pv.service")}
            </p>
            <p>
              <b>{t("rm.preview.time")}</b> {t("rm.preview.timeValue")}
            </p>
          </div>
          {/* The email uses the page colour, the one clients know. */}
          <p
            className="mt-3 inline-block rounded-lg px-3 py-2 text-[13px] font-bold"
            style={{ backgroundColor: page.brand, color: page.foreground }}
          >
            {t("rm.preview.cta")}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{t("rm.onlyEmail")}</p>
      </section>
    </div>
  );
}
