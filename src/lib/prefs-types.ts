export type Theme = "light" | "dark";
export type Lang = "pt" | "pt-BR" | "en" | "es" | "fr" | "it" | "de";

/** Languages with hand-written module dictionaries; the others are flat locale files. */
export type BaseLang = "pt" | "en";

export const LANGS: { code: Lang; label: string; short: string; locale: string }[] = [
  { code: "pt", label: "Português (Portugal)", short: "PT", locale: "pt-PT" },
  { code: "pt-BR", label: "Português (Brasil)", short: "BR", locale: "pt-BR" },
  { code: "en", label: "English", short: "EN", locale: "en-GB" },
  { code: "es", label: "Español", short: "ES", locale: "es-ES" },
  { code: "fr", label: "Français", short: "FR", locale: "fr-FR" },
  { code: "it", label: "Italiano", short: "IT", locale: "it-IT" },
  { code: "de", label: "Deutsch", short: "DE", locale: "de-DE" },
];

export function isLang(value: unknown): value is Lang {
  return LANGS.some((l) => l.code === value);
}

/** Intl locale for dates, times and prices in the chosen language. */
export function localeOf(lang: Lang): string {
  return LANGS.find((l) => l.code === lang)?.locale ?? "pt-PT";
}
