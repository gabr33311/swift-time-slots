import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { usePrefs } from "@/lib/prefs";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "sycras-install-dismissed";

/** Discreet, optional "Add to home screen" card. Never blocks the UI. */
export function InstallPrompt() {
  const { t } = usePrefs();
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || !deferred) return null;

  return (
    <div className="surface mt-6 flex items-center gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Download className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t("ui.install.title")}</p>
        <p className="text-sm text-muted-foreground">{t("ui.install.body")}</p>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        {t("ui.install.action")}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("ui.install.dismiss")}
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setHidden(true);
        }}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
