import { Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** A calm note that this feature needs paid Pro, with a link to the plans. */
export function ProLock({ text, className }: { text: string; className?: string }) {
  const { t } = usePrefs();
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-subscription-accent/50 bg-card p-4",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-subscription-accent/12 text-subscription-accent">
        <Crown className="size-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t("sub.locked")}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <Link
        to="/plans"
        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-muted"
      >
        {t("sub.locked.cta")}
      </Link>
    </div>
  );
}
