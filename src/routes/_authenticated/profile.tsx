import { createFileRoute } from "@tanstack/react-router";
import { useState, type ComponentType } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { BusinessPanel } from "@/components/panels/business-panel";
import { ServicesPanel } from "@/components/panels/services-panel";
import { TeamPanel } from "@/components/panels/team-panel";
import { AvailabilityPanel } from "@/components/panels/availability-panel";
import { AnalyticsPanel } from "@/components/panels/analytics-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import {
  Building2,
  Scissors,
  UserRound,
  Clock,
  ChevronRight,
  ArrowLeft,
  BarChart3,
  Settings,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Perfil — Schedivo" },
      {
        name: "description",
        content: "Negócio, serviços, equipa, horários e estatísticas num só lugar.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type SectionId =
  | "business"
  | "services"
  | "team"
  | "availability"
  | "analytics"
  | "settings";

type SectionItem = {
  id: SectionId;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const GROUPS: { title: string; items: SectionItem[] }[] = [
  {
    title: "Negócio",
    items: [
      {
        id: "business",
        label: "Negócio",
        description: "Nome, foto, contactos e regras de cancelamento.",
        icon: Building2,
      },
      {
        id: "services",
        label: "Serviços",
        description: "O que os clientes podem marcar.",
        icon: Scissors,
      },
      { id: "team", label: "Equipa", description: "Quem atende os clientes.", icon: UserRound },
      {
        id: "availability",
        label: "Disponibilidade",
        description: "Horário semanal, almoço e folgas.",
        icon: Clock,
      },
    ],
  },
  {
    title: "Gestão",
    items: [
      {
        id: "analytics",
        label: "Estatísticas",
        description: "Receita, cancelamentos e serviços mais rentáveis.",
        icon: BarChart3,
      },
      {
        id: "settings",
        label: "Definições",
        description: "Publicação da página, tema e idioma.",
        icon: Settings,
      },
    ],
  },
];

const SECTIONS = GROUPS.flatMap((g) => g.items);


function ProfilePage() {
  const [section, setSection] = useState<SectionId | null>(null);
  const active = SECTIONS.find((s) => s.id === section);

  return (
    <AppShell>
      <PageHeader
        title={active ? active.label : "Perfil"}
        subtitle={active ? active.description : "Tudo sobre o teu negócio num só sítio."}
        action={
          active ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Voltar"
              className="size-9 text-muted-foreground"
              onClick={() => setSection(null)}
            >
              <ArrowLeft className="size-5" strokeWidth={2.5} />
            </Button>
          ) : undefined
        }
      />

      {!active ? (
        <div className="space-y-7">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className="surface surface-hover flex items-center gap-4 p-5 text-left"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                      <s.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{s.label}</span>
                      <span className="block text-sm text-muted-foreground">{s.description}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div key={section}>
          {section === "business" && <BusinessPanel />}
          {section === "services" && <ServicesPanel />}
          {section === "team" && <TeamPanel />}
          {section === "availability" && <AvailabilityPanel />}
          {section === "analytics" && <AnalyticsPanel />}
          {section === "settings" && <SettingsPanel />}
        </div>
      )}
    </AppShell>
  );
}
