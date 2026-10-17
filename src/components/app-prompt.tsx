import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_ON_PLAY, isAndroidBrowser, PLAY_STORE_URL } from "@/lib/app-store";
import { usePrefs } from "@/lib/prefs";

const KEY = "sycras-app-prompt";

/**
 * On an Android phone's browser, invites the owner to the app (made for the
 * phone), with a small "continue in the browser". Asked once per visit.
 */
export function AppPrompt() {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!APP_ON_PLAY || !isAndroidBrowser()) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      // Storage blocked: still show it once now.
    }
    setOpen(true);
  }, []);

  function close() {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Ignore.
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-[2px] sm:items-center sm:justify-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-prompt-title"
        className="animate-enter w-full rounded-t-3xl border border-border bg-card p-6 pb-[calc(1.5rem+var(--sab))] text-center shadow-lg sm:max-w-sm sm:rounded-3xl"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand/12 text-brand-ink">
          <Smartphone className="size-6" />
        </span>
        <h2 id="app-prompt-title" className="mt-4 font-display text-xl font-bold">
          {t("app.prompt.title")}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("app.prompt.body")}</p>
        <Button asChild size="lg" variant="brand" className="mt-5 w-full">
          <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" onClick={close}>
            {t("app.prompt.install")}
          </a>
        </Button>
        <button
          type="button"
          onClick={close}
          className="mt-3 h-10 w-full rounded-full text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("app.prompt.browser")}
        </button>
      </div>
    </div>
  );
}
