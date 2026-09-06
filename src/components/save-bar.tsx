import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { usePrefs } from "@/lib/prefs";

/** Floating "unsaved changes" bar shown whenever an inline form is dirty. */
export function SaveBar({
  dirty,
  busy,
  onSave,
  onCancel,
}: {
  dirty: boolean;
  busy?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  if (!dirty) return null;
  return (
    <div className="animate-enter sticky bottom-3 z-30 mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lift backdrop-blur">
      <p className="min-w-0 flex-1 text-[13px] font-bold">{t("ui.save.unsaved")}</p>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
        {t("ui.save.cancel")}
      </Button>
      <Button size="sm" onClick={onSave} disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />} {t("ui.save.save")}
      </Button>
    </div>
  );
}
