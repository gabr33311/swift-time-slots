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
      { title: "Profile — Schedivo" },
      {
        name: "description",
        content: "Business, services, team, hours and stats in one place.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type SectionId = "availability" | "analytics" | "settings";

const LINKS: { id: SectionId; icon: ComponentType<{ className?: string }> }[] = [
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("pf.section.settings")}
                className="size-9 text-muted-foreground"
                onClick={() => setSection("settings")}
              >
                <Settings className="size-[18px] strokeWidth={2.5}" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("pf.section.analytics")}
                className="size-9 text-muted-foreground"
                onClick={() => setSection("analytics")}
              >
                <BarChart3 className="size-[18px] strokeWidth={2.5}" />
              </Button>
            </div>
          )
        }
      />

      {!section ? (
        <div className="space-y-8">
          <BusinessPanel />

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Scissors className="size-4" /> {t("pf.section.services")}
            </h2>
            <ServicesPanel />
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <UserRound className="size-4" /> {t("pf.section.team")}
            </h2>
            <TeamPanel />
          </section>

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
                  <span className="block text-sm font-bold">
                    {s.id === "availability" ? t("pf.editAvailability") : label(s.id)}
                  </span>
                  <span className="block text-sm text-muted-foreground">{desc(s.id)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div key={section}>
          {section === "availability" && <AvailabilityPanel />}
          {section === "analytics" && <AnalyticsPanel />}
          {section === "settings" && <SettingsPanel />}
        </div>
      )}
    </AppShell>
  );
}
