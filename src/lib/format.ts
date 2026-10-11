import { localeOf, type Lang } from "./prefs-types";

let CURRENT_LANG: Lang = "pt";

/** Set by the prefs provider so all formatters follow the chosen language. */
export function setFormatLang(lang: Lang) {
  CURRENT_LANG = lang;
}

function locale(lang?: Lang) {
  return localeOf(lang ?? CURRENT_LANG);
}

/** Intl locale of the current language, for components that format by hand. */
export function currentLocale(): string {
  return locale();
}

/** Sunday-first weekday names from Intl, capitalised (2024-01-07 was a Sunday). */
function intlWeekdays(lang: Lang, weekday: "long" | "short"): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const name = new Intl.DateTimeFormat(localeOf(lang), { weekday, timeZone: "UTC" })
      .format(new Date(Date.UTC(2024, 0, 7 + i, 12)))
      .replace(".", "");
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}

const WEEKDAYS: Record<"pt" | "en", string[]> = {
  pt: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const WEEKDAYS_SHORT: Record<"pt" | "en", string[]> = {
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export function weekdays(lang?: Lang): string[] {
  const l = lang ?? CURRENT_LANG;
  return l === "pt" || l === "en" ? WEEKDAYS[l] : intlWeekdays(l, "long");
}

export function weekdaysShort(lang?: Lang): string[] {
  const l = lang ?? CURRENT_LANG;
  return l === "pt" || l === "en" ? WEEKDAYS_SHORT[l] : intlWeekdays(l, "short");
}

/** @deprecated use weekdays(lang) */
export const WEEKDAYS_PT = WEEKDAYS.pt;
export const WEEKDAYS_SHORT_PT = WEEKDAYS_SHORT.pt;

export function formatPrice(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat(locale(), {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function formatDateLong(iso: string, timeZone = "Europe/Lisbon"): string {
  return new Intl.DateTimeFormat(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date(iso));
}

export function formatDateShort(iso: string, timeZone = "Europe/Lisbon"): string {
  return new Intl.DateTimeFormat(locale(), {
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = "Europe/Lisbon"): string {
  return new Intl.DateTimeFormat(locale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

export function greetingPt(date = new Date(), lang: Lang = "pt"): string {
  const h = date.getHours();
  if (lang !== "pt" && lang !== "pt-BR") {
    if (h < 12) return "Good morning";
    if (h < 19) return "Good afternoon";
    return "Good evening";
  }
  if (h < 13) return "Bom dia";
  if (h < 20) return "Boa tarde";
  return "Boa noite";
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const STATUS_LABELS_BY_LANG: Record<Lang, Record<string, string>> = {
  pt: {
    pending: "Pendente",
    confirmed: "Confirmada",
    completed: "Concluída",
    cancelled: "Cancelada",
    no_show: "Não compareceu",
    expired: "Expirada",
  },
  en: {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No show",
    expired: "Expired",
  },
  "pt-BR": {
    pending: "Pendente",
    confirmed: "Confirmado",
    completed: "Concluído",
    cancelled: "Cancelado",
    no_show: "Não compareceu",
    expired: "Expirado",
  },
  es: {
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No se presentó",
    expired: "Caducada",
  },
  fr: {
    pending: "En attente",
    confirmed: "Confirmé",
    completed: "Terminé",
    cancelled: "Annulé",
    no_show: "Absent",
    expired: "Expiré",
  },
  it: {
    pending: "In attesa",
    confirmed: "Confermato",
    completed: "Completato",
    cancelled: "Annullato",
    no_show: "Non presentato",
    expired: "Scaduto",
  },
  de: {
    pending: "Ausstehend",
    confirmed: "Bestätigt",
    completed: "Abgeschlossen",
    cancelled: "Storniert",
    no_show: "Nicht erschienen",
    expired: "Abgelaufen",
  },
};

export function statusLabel(status: string, lang?: Lang): string {
  return STATUS_LABELS_BY_LANG[lang ?? CURRENT_LANG][status] ?? status;
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Never surface technical IDs as a customer name. */
export function displayCustomerName(
  name?: string | null,
  phone?: string | null,
  fallbackIndex?: number,
): string {
  const clean = (name ?? "").trim();
  const looksTechnical =
    !clean ||
    UUID_LIKE.test(clean) ||
    (clean.length > 18 &&
      !clean.includes(" ") &&
      /\d/.test(clean) &&
      /[a-f0-9-]{16,}/i.test(clean));
  if (!looksTechnical) return clean;
  const tel = (phone ?? "").trim();
  if (tel) return tel;
  const base = CURRENT_LANG === "en" ? "Customer" : "Cliente";
  return `${base}${fallbackIndex ? ` #${fallbackIndex}` : ""}`;
}
