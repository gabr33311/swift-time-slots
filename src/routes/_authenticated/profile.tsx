import { createFileRoute, Link } from "@tanstack/react-router";
import { usePrefs } from "@/lib/prefs";
import { useState, type ComponentType } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
  Crown,
  ArrowUpRight,
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
  // Phones drill into one section at a time; from md up the menu stays on the
  // left and the first section fills the right column by default.
  const shown: SectionId = section ?? "info";

  return (
    <AppShell>
      <PageHeader
        title={section ? label(section) : t("pf.manage.title")}
        subtitle={section ? desc(section) : ""}
        leading={
          section ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("pf.back")}
              className="text-foreground md:hidden"
              onClick={() => setSection(null)}
            >
              <ArrowLeft className="size-5" strokeWidth={2.5} />
            </Button>
          ) : null
        }
      />

      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div
          className={cn(
            "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card md:sticky md:top-24",
            section && "hidden md:block",
          )}
        >
          {ROWS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSection(row.id)}
              aria-current={shown === row.id ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                shown === row.id && "md:bg-muted",
              )}
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
              <ChevronRight className="size-4 shrink-0 text-muted-foreground md:hidden" strokeWidth={2.5} />
            </button>
          ))}
          <Link
            to="/plans"
            className="group relative flex w-full items-center gap-3.5 overflow-hidden bg-gradient-to-br from-subscription-accent-soft via-card to-card px-4 py-4 text-left transition-colors hover:bg-muted/40"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-subscription-accent/15 text-subscription-accent ring-1 ring-subscription-accent/20">
              <Crown className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold leading-tight">{t("sub.menu.title")}</span>
              <span className="mt-1 line-clamp-2 block max-w-md text-xs leading-snug text-muted-foreground">
                {t("sub.menu.desc")}
              </span>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-subscription-accent/15 px-2.5 py-1 text-[10px] font-black uppercase text-subscription-accent">
                  {t("sub.menu.current")}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
                  {t("sub.menu.upgrade")} <ArrowUpRight className="size-3.5" />
                </span>
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-subscription-accent transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div key={shown} className={cn("animate-enter min-w-0", !section && "hidden md:block")}>
          {shown === "info" && <BusinessPanel />}
          {shown === "servicesTeam" && <ServicesTeamPanel />}
          {shown === "availability" && <AvailabilityPanel />}
          {shown === "analytics" && <AnalyticsPanel />}
          {shown === "settings" && <SettingsPanel />}
        </div>
      </div>
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
