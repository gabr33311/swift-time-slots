import { createContext, useContext } from "react";
import type { Lang, Theme } from "./prefs-types";
import { DICT } from "./prefs-dict";

export type PrefsValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
};

export const PrefsContext = createContext<PrefsValue | null>(null);

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) {
    return {
      theme: "light",
      setTheme: () => {},
      toggleTheme: () => {},
      lang: "pt",
      setLang: () => {},
      toggleLang: () => {},
      t: (key: string) => DICT.pt[key] ?? key,
    };
  }
  return ctx;
}
