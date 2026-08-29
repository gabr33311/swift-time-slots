import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Clock, Share2, ShieldCheck, Sparkles, Users } from "lucide-react";
import { PrefsToggles } from "@/components/prefs-toggles";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Schedivo — Marcações online para o teu negócio" },
      {
        name: "description",
        content:
          "Cria a tua página de marcações em minutos. Agenda, clientes e lembretes num só sítio, feito para negócios em Portugal.",
      },
      { property: "og:title", content: "Schedivo — Marcações online para o teu negócio" },
      {
        property: "og:description",
        content:
          "Página de marcações, agenda e clientes num só sítio. Simples, rápido e feito para Portugal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Share2, key: "f1" },
  { icon: CalendarCheck, key: "f2" },
  { icon: Users, key: "f3" },
  { icon: Clock, key: "f4" },
  { icon: ShieldCheck, key: "f5" },
  { icon: Sparkles, key: "f6" },
] as const;

function Landing() {
  const { t } = usePrefs();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <span className="text-lg font-bold tracking-tight">Schedivo</span>
        <PrefsToggles />
      </header>

      <main>
        <section className="animate-enter mx-auto max-w-3xl px-5 pb-16 pt-12 text-center sm:pt-20">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t("home.eyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{t("home.title")}</h1>
          <p className="mx-auto mt-5 max-w-xl text-base font-medium text-muted-foreground">
            {t("home.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "register", next: undefined }}>
              <Button size="lg">{t("home.cta.create")}</Button>
            </Link>
            <Link to="/auth" search={{ mode: undefined, next: undefined }}>
              <Button size="lg" variant="outline">
                {t("home.cta.have")}
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-20">
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2.5">
            {FEATURES.map((f) => (
              <article key={f.key} className="surface surface-hover animate-enter p-4">
                <f.icon className="size-5 text-primary" strokeWidth={2.5} />
                <h2 className="mt-3 text-[15px] font-bold leading-snug">{t(`${f.key}.title`)}</h2>
                <p className="mt-1 text-[13px] font-medium leading-snug text-muted-foreground">
                  {t(`${f.key}.body`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-24 text-center animate-enter">
          <Link to="/auth" search={{ mode: "register", next: undefined }} className="inline-block">
            <Button size="lg">{t("home.cta.start")}</Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 text-center text-sm font-medium text-muted-foreground">
        {t("home.footer")}
      </footer>
    </div>
  );
}
