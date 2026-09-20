import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "@/lib/prefs";
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
      { title: "Perfil — SYCRAS" },
      {
        name: "description",
        content: "Business, services, team, hours and stats in one place.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type SectionId =
  | "info"
  | "services"
  | "team"
  | "availability"
  | "analytics"
  | "settings";

const LINKS: { id: SectionId; icon: ComponentType<{ className?: string }> }[] = [
  { id: "info", icon: Building2 },
  { id: "services", icon: Scissors },
  { id: "team", icon: UserRound },
  { id: "availability", icon: Clock },
];

function ProfilePage() {
  const { t } = usePrefs();
  const [section, setSection] = useState<SectionId | null>(null);
  const label = (id: SectionId) => t(`pf.section.${id}`);
  const desc = (id: SectionId) => t(`pf.section.${id}.desc`);

  return (
    <AppShell>
      <PageHeader
        title={section ? label(section) : t("pf.title")}
        subtitle={section ? desc(section) : t("pf.subtitle")}
        action={
          section ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("pf.back")}
              className="size-9 text-muted-foreground"
              onClick={() => setSection(null)}
            >
              <ArrowLeft className="size-5" strokeWidth={2.5} />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t("pf.section.settings")}
                onClick={() => setSection("settings")}
                className="flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Settings className="size-5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label={t("pf.section.analytics")}
                onClick={() => setSection("analytics")}
                className="flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <BarChart3 className="size-5" strokeWidth={2.5} />
              </button>
            </div>
          )
        }
      />

      {!section ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {LINKS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="surface surface-hover flex items-center gap-4 p-5 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <s.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{label(s.id)}</span>
                <span className="block text-sm text-muted-foreground">{desc(s.id)}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      ) : (
        <div key={section} className="animate-enter">
          {section === "info" && <BusinessPanel />}
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
