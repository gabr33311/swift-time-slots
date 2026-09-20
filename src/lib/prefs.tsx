import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang, Theme } from "./prefs-types";
import { customersDict } from "./i18n/customers";
import { calendarDict } from "./i18n/calendar";
import { profileDict } from "./i18n/profile";
import { appointmentsDict } from "./i18n/appointments";
import { bookingDict } from "./i18n/booking";
import { onboardingDict } from "./i18n/onboarding";
import { commonDict } from "./i18n/common";
import { setFormatLang } from "./format";

export type { Lang, Theme };

const BASE: Record<Lang, Record<string, string>> = {
  pt: {
    "home.eyebrow": "Para barbearias, salões, clínicas e estúdios",
    "home.title": "As tuas marcações, sem telefonemas nem confusão.",
    "home.subtitle":
      "Cria a tua página de marcações, partilha o link e deixa os clientes escolherem o horário. Tu ficas com a agenda organizada.",
    "home.cta.create": "Criar a minha página",
    "home.cta.have": "Já tenho conta",
    "home.cta.start": "Começar agora",
    "home.footer": "SYCRAS · Marcações online para negócios em Portugal",
    "f1.title": "Um link, marcações a entrar",
    "f1.body":
      "Partilha a tua página no Instagram ou WhatsApp e recebe marcações 24 horas por dia.",
    "f2.title": "Agenda sempre certa",
    "f2.body":
      "Nunca há dois clientes no mesmo horário — o sistema bloqueia sobreposições automaticamente.",
    "f3.title": "Clientes organizados",
    "f3.body": "Cada marcação cria a ficha do cliente, com histórico, contactos e notas.",
    "f4.title": "Horários à tua medida",
    "f4.body": "Define horários por dia, folgas e intervalos entre serviços.",
    "f5.title": "Dados protegidos",
    "f5.body": "Cada negócio só vê os seus dados. Cancelamentos com regras que tu defines.",
    "f6.title": "Pronto em minutos",
    "f6.body": "Escolhe o teu sector e começamos com serviços e horários já sugeridos.",
    "prefs.theme": "Modo escuro",
    "prefs.theme.desc": "Muda o aspecto da aplicação para tons escuros.",
    "prefs.lang": "Idioma",
    "prefs.lang.desc": "Escolhe a língua da aplicação.",
    "showcase.title": "Assim é por dentro",
    "showcase.body": "A tua agenda e a página que os clientes vêem — simples nos dois lados.",
    "showcase.agenda": "Agenda do dia, sempre organizada",
    "showcase.booking": "Página pública de marcações",
    "nav.today": "Hoje",
    "nav.calendar": "Agenda",
    "nav.customers": "Clientes",
    "nav.share": "Partilhar",
    "nav.profile": "Perfil",
    "nav.logout": "Terminar sessão",
    "nav.close": "Fechar",
    "dash.subtitle": "Aqui está o teu dia.",
    "dash.notifications": "Notificações",
    "dash.markRead": "Marcar lidas",
    "dash.notifications.empty": "Sem notificações por agora.",
    "dash.today": "Marcações de hoje",
    "dash.confirmed": "Confirmadas",
    "dash.pending": "Pendentes",
    "dash.cancelled": "Canceladas",
    "dash.completed": "Concluídas",
    "dash.upcoming": "Próximas marcações",
    "dash.new": "Nova marcação",
    "dash.empty.title": "Sem marcações para já.",
    "dash.empty.body": "Quando os teus clientes marcarem, vais vê-las aqui.",
    "dash.todayLabel": "Hoje",
    "dash.now.ongoing": "A decorrer agora",
    "dash.now.next": "A seguir",
    "dash.now.inMin": "daqui a {n} min",
    "dash.now.inHours": "daqui a {h}h{m}",
    "dash.now.late": "atrasada {n} min",
    "dash.progress.title": "O teu dia",
    "dash.progress.done": "{done} de {total} concluídas",
    "dash.progress.revenue": "Previsto hoje",
    "dash.progress.free": "Sem marcações hoje.",
    "dash.todayList": "Hoje",
    "dash.nextDays": "Próximos dias",
    "dash.today.empty": "Dia livre. Sem marcações para hoje.",
    "dash.overdue.title": "Por fechar",
    "dash.overdue.done": "Concluído",
    "dash.overdue.noshow": "Não veio",
    "dash.overdue.saved": "Marcação atualizada.",
    "share.title": "Partilhar",
    "share.subtitle": "Tudo o que o cliente vê: link, código QR e personalização.",
    "share.customize": "Personalizar página",
  },
  en: {
    "home.eyebrow": "For barbershops, salons, clinics and studios",
    "home.title": "Your bookings, without phone calls or confusion.",
    "home.subtitle":
      "Create your booking page, share the link and let clients pick their time. You keep a tidy schedule.",
    "home.cta.create": "Create my page",
    "home.cta.have": "I already have an account",
    "home.cta.start": "Get started",
    "home.footer": "SYCRAS · Online booking for small businesses",
    "f1.title": "One link, bookings coming in",
    "f1.body": "Share your page on Instagram or WhatsApp and take bookings 24 hours a day.",
    "f2.title": "An always-correct agenda",
    "f2.body": "Never two clients in the same slot — overlaps are blocked automatically.",
    "f3.title": "Organised clients",
    "f3.body": "Every booking creates a client record, with history, contacts and notes.",
    "f4.title": "Hours your way",
    "f4.body": "Set hours per day, days off and buffers between services.",
    "f5.title": "Protected data",
    "f5.body": "Each business only sees its own data. Cancellation rules you define.",
    "f6.title": "Ready in minutes",
    "f6.body": "Pick your industry and start with suggested services and hours.",
    "prefs.theme": "Dark mode",
    "prefs.theme.desc": "Switch the app to a darker look.",
    "prefs.lang": "Language",
    "prefs.lang.desc": "Choose the app language.",
    "showcase.title": "A look inside",
    "showcase.body": "Your agenda and the page clients see — simple on both sides.",
    "showcase.agenda": "A tidy daily agenda",
    "showcase.booking": "Public booking page",
    "nav.today": "Today",
    "nav.calendar": "Calendar",
    "nav.customers": "Clients",
    "nav.share": "Share",
    "nav.profile": "Profile",
    "nav.logout": "Sign out",
    "nav.close": "Close",
    "dash.subtitle": "Here is your day.",
    "dash.notifications": "Notifications",
    "dash.markRead": "Mark as read",
    "dash.notifications.empty": "No notifications yet.",
    "dash.today": "Today's bookings",
    "dash.confirmed": "Confirmed",
    "dash.pending": "Pending",
    "dash.cancelled": "Cancelled",
    "dash.completed": "Completed",
    "dash.upcoming": "Upcoming bookings",
    "dash.new": "New booking",
    "dash.empty.title": "No bookings yet.",
    "dash.empty.body": "When your clients book, you'll see them here.",
    "dash.todayLabel": "Today",
    "dash.now.ongoing": "Happening now",
    "dash.now.next": "Up next",
    "dash.now.inMin": "in {n} min",
    "dash.now.inHours": "in {h}h{m}",
    "dash.now.late": "{n} min late",
    "dash.progress.title": "Your day",
    "dash.progress.done": "{done} of {total} done",
    "dash.progress.revenue": "Expected today",
    "dash.progress.free": "No bookings today.",
    "dash.todayList": "Today",
    "dash.nextDays": "Next days",
    "dash.today.empty": "Free day. No bookings for today.",
    "dash.overdue.title": "To close",
    "dash.overdue.done": "Completed",
    "dash.overdue.noshow": "No-show",
    "dash.overdue.saved": "Booking updated.",
    "share.title": "Share",
    "share.subtitle": "Everything the client sees: link, QR code and customization.",
    "share.customize": "Customize page",
  },
};

const MODULES = [
  commonDict,
  customersDict,
  calendarDict,
  profileDict,
  appointmentsDict,
  bookingDict,
  onboardingDict,
];

const DICT: Record<Lang, Record<string, string>> = {
  pt: Object.assign({}, BASE.pt, ...MODULES.map((m) => m.pt)),
  en: Object.assign({}, BASE.en, ...MODULES.map((m) => m.en)),
};

type PrefsValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
};

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    const storedTheme = (window.localStorage.getItem("sycras-theme") ??
      window.localStorage.getItem("schedivo-theme")) as Theme | null;
    const storedLang = (window.localStorage.getItem("sycras-lang") ??
      window.localStorage.getItem("schedivo-lang")) as Lang | null;
    if (storedTheme === "dark" || storedTheme === "light") setThemeState(storedTheme);
    if (storedLang === "pt" || storedLang === "en") setLangState(storedLang);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    setFormatLang(lang);
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
    toggleLang: () => setLang(lang === "pt" ? "en" : "pt"),
    t: (key: string) => DICT[lang][key] ?? DICT.pt[key] ?? key,
  };

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

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
