import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { ShareSheet } from "@/components/share-sheet";
import {
  Building2,
  BriefcaseBusiness,
  Clock,
  ArrowLeft,
  BarChart3,
  Settings,
  Users,
  Share2,
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
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionId | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
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
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("pf.share.share")}
              className="size-9 text-foreground"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="size-5" strokeWidth={2.4} />
            </Button>
          )
        }
      />

      {!section ? (
        <div className="space-y-5">
          {CATEGORIES.map((cat) => (
            <section key={cat.key} className="space-y-2">
              <h2 className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {t(cat.key)}
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cat.tiles.map((tile) => {
                  const text =
                    tile.kind === "section" ? label(tile.id) : t(tile.labelKey);
                  return (
                    <button
                      key={tile.kind === "section" ? tile.id : tile.to}
                      type="button"
                      onClick={() =>
                        tile.kind === "section"
                          ? setSection(tile.id)
                          : navigate({ to: tile.to })
                      }
                      className="surface surface-hover flex flex-col items-start gap-2.5 p-3.5 text-left"
                    >
                      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                        <tile.icon className="size-[18px]" />
                      </span>
                      <span className="text-[13px] font-bold leading-tight">{text}</span>
                    </button>
                  );
                })}
              </div>
            </section>
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
      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} />
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
