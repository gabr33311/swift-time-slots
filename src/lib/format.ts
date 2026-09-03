let CURRENT_LANG: "pt" | "en" = "pt";

/** Set once by the prefs provider so all formatters follow the chosen language. */
export function setFormatLang(lang: "pt" | "en") {
  CURRENT_LANG = lang;
}

const LOCALE: Record<"pt" | "en", string> = { pt: "pt-PT", en: "en-GB" };

function locale(lang?: "pt" | "en") {
  return LOCALE[lang ?? CURRENT_LANG];
}

const WEEKDAYS: Record<"pt" | "en", string[]> = {
  pt: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const WEEKDAYS_SHORT: Record<"pt" | "en", string[]> = {
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export function weekdays(lang?: "pt" | "en"): string[] {
  return WEEKDAYS[lang ?? CURRENT_LANG];
}

export function weekdaysShort(lang?: "pt" | "en"): string[] {
  return WEEKDAYS_SHORT[lang ?? CURRENT_LANG];
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

export function greetingPt(date = new Date(), lang: "pt" | "en" = "pt"): string {
  const h = date.getHours();
  if (lang === "en") {
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

const STATUS_LABELS_BY_LANG: Record<"pt" | "en", Record<string, string>> = {
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
};

export function statusLabel(status: string, lang?: "pt" | "en"): string {
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
    (clean.length > 18 && !clean.includes(" ") && /\d/.test(clean) && /[a-f0-9-]{16,}/i.test(clean));
  if (!looksTechnical) return clean;
  const tel = (phone ?? "").trim();
  if (tel) return tel;
  const base = CURRENT_LANG === "en" ? "Customer" : "Cliente";
  return `${base}${fallbackIndex ? ` #${fallbackIndex}` : ""}`;
}
