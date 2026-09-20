import { createFileRoute } from "@tanstack/react-router";
import { usePrefs } from "@/lib/prefs";
import { useState, type ComponentType } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BusinessPanel } from "@/components/panels/business-panel";
import { ServicesPanel } from "@/components/panels/services-panel";
import { TeamPanel } from "@/components/panels/team-panel";
import { AvailabilityPanel } from "@/components/panels/availability-panel";
import { AnalyticsPanel } from "@/components/panels/analytics-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import {
  Building2,
  BriefcaseBusiness,
  Clock,
  ArrowLeft,
  BarChart3,
  Settings,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Gestão — SYCRAS" },
      {
        name: "description",
        content: "Business, services, team, hours and stats in one place.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Gestão — SYCRAS" },
      {
        property: "og:description",
        content: "Business, services, team, hours and stats in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type SectionId =
  | "info"
  | "servicesTeam"
  | "availability"
  | "analytics"
  | "settings";

const ROWS: { id: SectionId; icon: ComponentType<{ className?: string }> }[] = [
  { id: "info", icon: Building2 },
  { id: "servicesTeam", icon: BriefcaseBusiness },
  { id: "availability", icon: Clock },
  { id: "analytics", icon: BarChart3 },
  { id: "settings", icon: Settings },
];

function ProfilePage() {
  const { t } = usePrefs();
  const [section, setSection] = useState<SectionId | null>(null);
  const label = (id: SectionId) => t(`pf.section.${id}`);
  const desc = (id: SectionId) => t(`pf.section.${id}.desc`);

  return (
    <AppShell>
      <PageHeader
        title={section ? label(section) : t("pf.manage.title")}
        subtitle={section ? desc(section) : ""}
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
          ) : null
        }
      />

      {!section ? (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {ROWS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSection(row.id)}
              className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-muted/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <row.icon className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight">{label(row.id)}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {desc(row.id)}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.5} />
            </button>
          ))}
        </div>
      ) : (
        <div key={section} className="animate-enter">
          {section === "info" && <BusinessPanel />}
          {section === "servicesTeam" && <ServicesTeamPanel />}
          {section === "availability" && <AvailabilityPanel />}
          {section === "analytics" && <AnalyticsPanel />}
          {section === "settings" && <SettingsPanel />}
        </div>
      )}
    </AppShell>
  );
}

function ServicesTeamPanel() {
  const { t } = usePrefs();

  return (
    <Tabs defaultValue="services" className="w-full">
      <TabsList className="mb-4 grid w-full grid-cols-2">
        <TabsTrigger value="services">{t("pf.section.services")}</TabsTrigger>
        <TabsTrigger value="team">{t("pf.section.team")}</TabsTrigger>
      </TabsList>
      <TabsContent value="services">
        <ServicesPanel />
      </TabsContent>
      <TabsContent value="team">
        <TeamPanel />
      </TabsContent>
    </Tabs>
  );
}
