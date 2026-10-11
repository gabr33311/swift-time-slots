import { useCallback, useEffect, useState, type ReactNode } from "react";
import { isLang, LANGS, type Lang, type Theme } from "./prefs-types";
import { setFormatLang } from "./format";
import { DICT, dictFor, loadLang } from "./prefs-dict";
import { PrefsContext, type PrefsValue } from "./prefs-context";

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [lang, setLangState] = useState<Lang>("pt");
  // Bumped when an on-demand language finishes loading, to re-render with it.
  const [, setLoadedTick] = useState(0);

  useEffect(() => {
    const storedTheme = (window.localStorage.getItem("sycras-theme") ??
      window.localStorage.getItem("schedivo-theme")) as Theme | null;
    const storedLang = (window.localStorage.getItem("sycras-lang") ??
      window.localStorage.getItem("schedivo-lang")) as Lang | null;
    if (storedTheme === "dark" || storedTheme === "light") setThemeState(storedTheme);
    if (isLang(storedLang)) setLangState(storedLang);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Set during render (not only in an effect) so dates and prices switch on the same paint.
  setFormatLang(lang);
  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    let alive = true;
    loadLang(lang)
      .then(() => alive && setLoadedTick((n) => n + 1))
      .catch(() => {
        // Offline or blocked chunk: English stays as the fallback.
      });
    return () => {
      alive = false;
    };
  }, [lang]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem("sycras-theme", next);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem("sycras-lang", next);
    document.documentElement.setAttribute("lang", next);
  }, []);

  const value: PrefsValue = {
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    lang,
    setLang,
    toggleLang: () => {
      const i = LANGS.findIndex((l) => l.code === lang);
      setLang(LANGS[(i + 1) % LANGS.length]!.code);
    },
    t: (key: string) => dictFor(lang)[key] ?? DICT.pt[key] ?? key,
  };

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}
