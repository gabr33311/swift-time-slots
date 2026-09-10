import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { usePrefs } from "@/lib/prefs";

/**
 * Saves pending changes automatically when the panel unmounts (user leaves the
 * section) or when the tab/page is hidden.
 */
export function useAutoSaveOnExit(dirty: boolean, save: () => void | Promise<void>) {
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(save);
  dirtyRef.current = dirty;
  saveRef.current = save;

  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current) void saveRef.current();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, []);
}

/** Small island telling the user everything is saved automatically. */
export function AutoSaveNote({ className = "" }: { className?: string }) {
  const { t } = usePrefs();
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-[13px] font-bold text-muted-foreground ${className}`}
    >
      <Check className="size-4" strokeWidth={3} />
      {t("ui.save.auto")}
    </div>
  );
}
