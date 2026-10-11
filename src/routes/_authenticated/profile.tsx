import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { usePrefs } from "@/lib/prefs";
import { type ComponentType } from "react";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { BusinessPanel } from "@/components/panels/business-panel";
import { ServicesPanel } from "@/components/panels/services-panel";
import { TeamPanel } from "@/components/panels/team-panel";
import { AvailabilityPanel } from "@/components/panels/availability-panel";
import { PublicPagePanel } from "@/components/panels/public-page-panel";
import { SharePanel } from "@/components/panels/share-panel";
import { AnalyticsPanel } from "@/components/panels/analytics-panel";
import { SettingsPanel } from "@/components/panels/settings-panel";
import { RemindersPanel } from "@/components/panels/reminders-panel";
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  Building2,
  ChevronRight,
  Clock,
  Palette,
  Scissors,
  Settings,
  Share2,
  SlidersHorizontal,
  Users,
  CalendarOff,
} from "lucide-react";

const SECTION_IDS = [
  "info",
  "page",
  "share",
  "services",
  "team",
  "hours",
  "timeoff",
  "rules",
  "reminders",
  "analytics",
  "settings",
] as const;
type SectionId = (typeof SECTION_IDS)[number];

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: z.object({ section: z.enum(SECTION_IDS).optional() }),
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

type Row = { id: SectionId; icon: ComponentType<{ className?: string }> };

/**
 * The menu: only how the business is set up. Daily things live where they are
 * used: stats on Today, sharing in the header card, time off in the calendar,
 * settings and the plan behind the gear.
 */
const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "pf.group.business",
    rows: [
      { id: "info", icon: Building2 },
      { id: "page", icon: Palette },
    ],
  },
  {
    title: "pf.group.offer",
    rows: [
      { id: "services", icon: Scissors },
      { id: "team", icon: Users },
    ],
  },
  {
    title: "pf.group.time",
    rows: [
      { id: "hours", icon: Clock },
      { id: "rules", icon: SlidersHorizontal },
      { id: "reminders", icon: BellRing },
    ],
  },
];

function ProfilePage() {
  const { t } = usePrefs();
  const navigate = useNavigate();
  const { section } = Route.useSearch();
  // The open section lives in the URL: the phone's back button closes it.
  const setSection = (id: SectionId | null) =>
    void navigate({ to: "/profile", search: id ? { section: id } : {} });
  const label = (id: SectionId) => t(`pf.s.${id}`);
  const desc = (id: SectionId) => t(`pf.s.${id}.desc`);
  // Phones drill into one section at a time; from md up the menu stays on the
  // left and the first section fills the right column by default.
  const shown: SectionId = section ?? "info";
  const { business } = useMyBusiness();
  const logoUrl = useLogoUrl(business?.logo_url);

  return (
    <AppShell>
      <PageHeader
        title={section ? label(section) : t("pf.manage.title")}
        action={
          !section || section === "settings" ? (
            <Button
              variant="outline"
              size="icon"
              aria-label={t("pf.s.settings")}
              title={t("pf.s.settings")}
              onClick={() => setSection("settings")}
            >
              <Settings className="size-[18px]" />
            </Button>
          ) : null
        }
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

      <div className="md:grid md:grid-cols-[250px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <div className={cn("space-y-5 md:sticky md:top-24", section && "hidden md:block")}>
          {/* Who this is about: the business, its public link and a way to see it. */}
          {business && (
            <div className="surface flex items-center gap-3.5 p-4 lg:hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-2xl object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground">
                  {initials(business.name)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base font-bold leading-tight">
                  {business.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  sycras.com/{business.slug}
                </span>
              </span>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label={t("pf.s.share")}
                title={t("pf.s.share")}
                onClick={() => setSection("share")}
              >
                <Share2 className="size-4" />
              </Button>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={`/${business.slug}`} target="_blank" rel="noreferrer">
                  {t("pf.manage.viewPage")}
                  <ArrowUpRight className="size-3.5" />
                </a>
              </Button>
            </div>
          )}

          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {t(group.title)}
              </h2>
              <nav className="surface divide-y divide-border overflow-hidden p-0">
                {group.rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSection(row.id)}
                    aria-current={shown === row.id ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
                      shown === row.id && "md:bg-muted",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-ink">
                      <row.icon className="size-[17px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold leading-tight">{label(row.id)}</span>
                      <span className="mt-0.5 block truncate text-xs font-normal leading-snug text-muted-foreground md:hidden">
                        {desc(row.id)}
                      </span>
                    </span>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground md:hidden"
                      strokeWidth={2.5}
                    />
                  </button>
                ))}
              </nav>
            </section>
          ))}
        </div>

        <div key={shown} className={cn("animate-enter min-w-0", !section && "hidden md:block")}>
          <p className="mb-4 hidden text-sm text-muted-foreground md:block">{desc(shown)}</p>
          {shown === "info" && <BusinessPanel />}
          {shown === "page" && <PublicPagePanel />}
          {shown === "share" && (
            <div className="surface flex justify-center px-4 py-8">
              <SharePanel />
            </div>
          )}
          {shown === "services" && <ServicesPanel />}
          {shown === "team" && <TeamPanel />}
          {shown === "hours" && (
            <div className="space-y-4">
              <AvailabilityPanel view="hours" />
              {/* Time off is part of the hours; it is no longer a separate menu row. */}
              <button
                type="button"
                onClick={() => setSection("timeoff")}
                className="surface flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-ink">
                  <CalendarOff className="size-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{t("pf.s.timeoff")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("pf.s.timeoff.desc")}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </div>
          )}
          {shown === "timeoff" && <AvailabilityPanel view="off" />}
          {shown === "rules" && <AvailabilityPanel view="rules" />}
          {shown === "reminders" && <RemindersPanel />}
          {shown === "analytics" && <AnalyticsPanel />}
          {shown === "settings" && <SettingsPanel />}
        </div>
      </div>
    </AppShell>
  );
}
