import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { BusinessPanel } from "@/components/panels/business-panel";
import { ServicesPanel } from "@/components/panels/services-panel";
import { TeamPanel } from "@/components/panels/team-panel";
import { AvailabilityPanel } from "@/components/panels/availability-panel";
import { AnalyticsPanel } from "@/components/panels/analytics-panel";
import { SharePanel } from "@/components/panels/share-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import {
  Building2,
  Scissors,
  UserRound,
  Clock,
  ChevronRight,
  ArrowLeft,
  BarChart3,
  Share2,
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

const SECTIONS = [
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
  {
    id: "booking",
    label: "Página de marcações",
    description: "Link público, partilha e código QR.",
    icon: Share2,
  },
  {
    id: "analytics",
    label: "Estatísticas",
    description: "Receita, cancelamentos e serviços mais rentáveis.",
    icon: BarChart3,
  },
  {
    id: "settings",
    label: "Definições",
    description: "Publicação da página e visibilidade no Google.",
    icon: Settings,
  },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];


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
            <Button variant="outline" size="sm" onClick={() => setSection(null)}>
              <ArrowLeft className="mr-2 size-4" /> Voltar
            </Button>
          ) : undefined
        }
      />

      {!active ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((s) => (
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
      ) : (
        <div key={section}>
          {section === "business" && <BusinessPanel />}
          {section === "services" && <ServicesPanel />}
          {section === "team" && <TeamPanel />}
          {section === "availability" && <AvailabilityPanel />}
          {section === "booking" && <SharePanel />}
          {section === "analytics" && <AnalyticsPanel />}
          {section === "settings" && <SettingsPanel />}
        </div>
      )}
    </AppShell>
  );
}
