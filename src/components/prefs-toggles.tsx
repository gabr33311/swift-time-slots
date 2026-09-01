import { Moon, Sun, Languages } from "lucide-react";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export function PrefsToggles({ className }: { className?: string }) {
  const { theme, toggleTheme, lang, toggleLang, t } = usePrefs();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? t("ui.prefs.lightMode") : t("ui.prefs.darkMode")}
        className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {theme === "dark" ? (
          <Sun className="size-4" strokeWidth={2.5} />
        ) : (
          <Moon className="size-4" strokeWidth={2.5} />
        )}
      </button>
      <button
        type="button"
        onClick={toggleLang}
        aria-label={t("ui.prefs.changeLang")}
        className="flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold uppercase text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Languages className="size-4" strokeWidth={2.5} />
        {lang}
      </button>
    </div>
  );
}
