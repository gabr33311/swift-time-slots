import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { initials } from "@/lib/format";
import {
  Building2,
  Scissors,
  UserRound,
  Clock,
  ArrowLeft,
  BarChart3,
  Settings,
  Users,
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

type Tile =
  | { kind: "section"; id: SectionId; icon: ComponentType<{ className?: string }> }
  | { kind: "link"; to: "/customers"; labelKey: string; icon: ComponentType<{ className?: string }> };

const CATEGORIES: { key: string; tiles: Tile[] }[] = [
  {
    key: "pf.cat.business",
    tiles: [
      { kind: "section", id: "info", icon: Building2 },
      { kind: "section", id: "services", icon: Scissors },
    ],
  },
  {
    key: "pf.cat.operation",
    tiles: [
      { kind: "section", id: "team", icon: UserRound },
      { kind: "section", id: "availability", icon: Clock },
      { kind: "link", to: "/customers", labelKey: "nav.customers", icon: Users },
    ],
  },
  {
    key: "pf.cat.system",
    tiles: [
      { kind: "section", id: "analytics", icon: BarChart3 },
      { kind: "section", id: "settings", icon: Settings },
    ],
  },
];

function ProfilePage() {
  const { t } = usePrefs();
  const navigate = useNavigate();
  const { business } = useMyBusiness();
  const logoUrl = useLogoUrl(business?.logo_url);
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
          ) : undefined
        }
      />

      {!section ? (
        <div className="space-y-5">
          <div className="surface flex items-center gap-3 p-4">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`${t("ui.photoOf")} ${business?.name ?? t("ui.photoOfProfile")}`}
                className="size-12 rounded-2xl object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground">
                {business ? initials(business.name) : "S"}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{business?.name ?? "SYCRAS"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {business ? `bookflow.pt/b/${business.slug}` : t("ui.loading")}
              </p>
            </div>
          </div>

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
