// Public entry point for preferences (theme, language, translations).
export type { Lang, Theme } from "./prefs-types";
export { usePrefs, type PrefsValue } from "./prefs-context";
export { PrefsProvider } from "./prefs-provider";
