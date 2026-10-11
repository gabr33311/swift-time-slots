import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { CalendarDays, House, Users, Store, LogOut, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { usePrefs } from "@/lib/prefs";
import { ShareSheet } from "@/components/share-sheet";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { Paywall, SubscriptionBanner } from "@/components/subscription-alerts";
import { useSubscription } from "@/hooks/use-subscription";
import { SycrasLogo } from "@/components/sycras-logo";
import { useBrandColor } from "@/lib/brand";

const NAV = [
  { to: "/today", label: "nav.today", icon: House },
  { to: "/calendar", label: "nav.calendar", icon: CalendarDays },
  { to: "/customers", label: "nav.customers", icon: Users },
  { to: "/profile", label: "nav.manage", icon: Store },
] as const;

/** Dock: the day on the left, people and management on the right, "+" in the middle. */
const DOCK_LEFT = [
  { to: "/today", label: "nav.today", icon: House },
  { to: "/calendar", label: "nav.calendar", icon: CalendarDays },
] as const;

const DOCK_RIGHT = [
  { to: "/customers", label: "nav.customers", icon: Users },
  { to: "/profile", label: "nav.manage", icon: Store },
] as const;

function PopIcon({
  Icon,
  className,
}: {
  Icon: ComponentType<{ className?: string | undefined; strokeWidth?: number | undefined }>;
  className?: string;
}) {
  return <Icon className={className} strokeWidth={2.5} />;
}

function NavList() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = usePrefs();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
              active
                ? "bg-brand/12 text-foreground shadow-[inset_3px_0_0_var(--brand)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <PopIcon Icon={item.icon} className="size-[18px]" />
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );
}

function DockTab({
  to,
  label,
  Icon,
  active,
}: {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string | undefined; strokeWidth?: number | undefined }>;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors duration-200",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-200",
          active && "bg-brand/15",
        )}
      >
        <PopIcon Icon={Icon} className="size-[19px]" />
      </span>
      <span className={cn("text-[10px] leading-none", active ? "font-bold" : "font-semibold")}>
        {label}
      </span>
    </Link>
  );
}

export function AppShell({
  children,
  onPrimaryAction,
}: {
  children: ReactNode;
  onPrimaryAction?: () => void;
}) {
  const { business, isSuccess } = useMyBusiness();
  const logoUrl = useLogoUrl(business?.logo_url);
  // The business colour tints the whole signed-in app.
  useBrandColor(business?.brand_color);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { access } = useSubscription();
  const locked =
    access?.state === "blocked" &&
    !pathname.startsWith("/plans") &&
    !pathname.startsWith("/profile");
  const { t } = usePrefs();
  const [shareOpen, setShareOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const startY = useRef(0);
  const held = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isSuccess && (!business || business.onboarding_completed === false))
      navigate({ to: "/onboarding", replace: true });
  }, [isSuccess, business, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: undefined, next: undefined } });
  }

  function down(y: number) {
    startY.current = y;
    held.current = false;
    timer.current = setTimeout(() => {
      held.current = true;
      setShareOpen(true);
    }, 480);
  }

  function up(y: number) {
    if (timer.current) clearTimeout(timer.current);
    if (held.current) return;
    if (startY.current - y > 36) setShareOpen(true);
    else if (onPrimaryAction) onPrimaryAction();
    else setNewOpen(true);
  }

  // Hold the panel until we know the setup is finished (avoids ghost-account flashes).
  if (!isSuccess || !business || business.onboarding_completed === false) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${t("ui.photoOf")} ${business?.name ?? t("ui.photoOfProfile")}`}
              className="size-9 rounded-xl object-cover ring-1 ring-border"
            />
          ) : business ? (
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              {initials(business.name)}
            </div>
          ) : (
            <SycrasLogo className="size-9" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{business?.name ?? "SYCRAS"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {business ? `/${business.slug}` : t("ui.loading")}
            </p>
          </div>
        </div>
        <NavList />
        <div className="mt-auto px-1 pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3"
            onClick={signOut}
          >
            <LogOut className="size-4" /> {t("nav.logout")}
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <main className="animate-enter mx-auto w-full max-w-5xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:px-5 lg:pb-12">
          <SubscriptionBanner />
          {/* Trial over without a subscription: only plans and settings stay open. */}
          {locked ? <Paywall /> : children}
        </main>
      </div>

      {/* Floating dock — the whole navigation of the app in one capsule */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(0.85rem+env(safe-area-inset-bottom))] lg:hidden">
        <nav className="dock pointer-events-auto flex items-center gap-1 rounded-[2rem] px-2.5 py-1.5">
          {DOCK_LEFT.map((item) => (
            <DockTab
              key={item.to}
              to={item.to}
              label={t(item.label)}
              Icon={item.icon}
              active={pathname.startsWith(item.to)}
            />
          ))}

          <button
            type="button"
            aria-label={t("dock.new")}
            title={t("dock.passHint")}
            onPointerDown={(e) => down(e.clientY)}
            onPointerUp={(e) => up(e.clientY)}
            onPointerLeave={() => timer.current && clearTimeout(timer.current)}
            className="dock-action mx-1 flex size-[52px] shrink-0 items-center justify-center rounded-full"
          >
            <Plus className="size-6" strokeWidth={3} />
          </button>

          {DOCK_RIGHT.map((item) => (
            <DockTab
              key={item.to}
              to={item.to}
              label={t(item.label)}
              Icon={item.icon}
              active={pathname.startsWith(item.to)}
            />
          ))}
        </nav>
      </div>

      <ShareSheet open={shareOpen} onOpenChange={setShareOpen} />
      {business ? (
        <NewAppointmentDialog business={business} open={newOpen} onOpenChange={setNewOpen} />
      ) : null}
    </div>
  );
}
