import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";

/**
 * Saves pending changes automatically when the panel unmounts (user leaves the
 * section) or when the tab/page is hidden, then confirms with a top toast.
 */
export function useAutoSaveOnExit(dirty: boolean, save: () => void | Promise<void>) {
  const { t } = usePrefs();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(save);
  const tRef = useRef(t);
  dirtyRef.current = dirty;
  saveRef.current = save;
  tRef.current = t;

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      void Promise.resolve(saveRef.current()).then(() => {
        toast.success(tRef.current("ui.save.auto"));
      });
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
