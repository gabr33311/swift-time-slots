import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Clock, Share2, ShieldCheck, Sparkles, Users } from "lucide-react";

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
  {
    icon: Share2,
    title: "Um link, marcações a entrar",
    body: "Partilha a tua página no Instagram ou WhatsApp e recebe marcações 24 horas por dia.",
  },
  {
    icon: CalendarCheck,
    title: "Agenda sempre certa",
    body: "Nunca há dois clientes no mesmo horário — o sistema bloqueia sobreposições automaticamente.",
  },
  {
    icon: Users,
    title: "Clientes organizados",
    body: "Cada marcação cria a ficha do cliente, com histórico, contactos e notas.",
  },
  {
    icon: Clock,
    title: "Horários à tua medida",
    body: "Define horários por dia, folgas e intervalos entre serviços.",
  },
  {
    icon: ShieldCheck,
    title: "Dados protegidos",
    body: "Cada negócio só vê os seus dados. Cancelamentos com regras que tu defines.",
  },
  {
    icon: Sparkles,
    title: "Pronto em minutos",
    body: "Escolhe o teu sector e começamos com serviços e horários já sugeridos.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <span className="text-lg font-bold tracking-tight">Schedivo</span>
      </header>

      <main>
        <section className="animate-enter mx-auto max-w-3xl px-5 pb-16 pt-12 text-center sm:pt-20">
          <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Para barbearias, salões, clínicas e estúdios
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            As tuas marcações, sem telefonemas nem confusão.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base font-medium text-muted-foreground">
            Cria a tua página de marcações, partilha o link e deixa os clientes escolherem o
            horário. Tu ficas com a agenda organizada.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "register" }}>
              <Button size="lg">Criar a minha página</Button>
            </Link>
            <Link to="/auth" search={{ mode: undefined }}>
              <Button size="lg" variant="outline">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 pb-20">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="surface surface-hover animate-enter p-6">
                <f.icon className="size-5 text-primary" />
                <h2 className="mt-4 text-base font-bold">{f.title}</h2>
                <p className="mt-1.5 text-sm font-medium text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 pb-24 text-center animate-enter">
          <Link to="/auth" search={{ mode: "register" }} className="inline-block">
            <Button size="lg">Começar agora</Button>
          </Link>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 text-center text-sm font-medium text-muted-foreground">
        Schedivo · Marcações online para negócios em Portugal
      </footer>
    </div>
  );
}
