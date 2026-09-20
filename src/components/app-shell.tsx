import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Users, Store, LogOut, Share2 } from "lucide-react";
import { type ComponentType, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";
import { usePrefs } from "@/lib/prefs";

const NAV = [
  { to: "/dashboard", label: "nav.today", icon: LayoutDashboard },
  { to: "/calendar", label: "nav.calendar", icon: CalendarDays },
  { to: "/customers", label: "nav.customers", icon: Users },
  { to: "/share", label: "nav.share", icon: Share2 },
  { to: "/profile", label: "nav.profile", icon: Store },
] as const;

// Bottom bar: Hoje first, then Agenda, Clientes, Partilhar, Perfil
const MOBILE_NAV = NAV;

function PopIcon({
  Icon,
  className,
}: {
  Icon: ComponentType<{ className?: string | undefined; strokeWidth?: number | undefined }>;
  className?: string;
}) {
  // Icons stay static — only functional colour transitions remain.
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
                ? "bg-primary/10 text-primary"
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

export function AppShell({ children }: { children: ReactNode }) {
  const { business } = useMyBusiness();
  const logoUrl = useLogoUrl(business?.logo_url);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = usePrefs();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: undefined, next: undefined } });
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
          ) : (
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              {business ? initials(business.name) : "S"}
            </div>
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
        <main className="animate-enter mx-auto w-full max-w-5xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 sm:px-5 lg:pb-12">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 pb-2 pt-2.5 text-[10.5px] font-bold tracking-tight transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200",
                  active && "bg-primary/12",
                )}
              >
                <PopIcon Icon={item.icon} className="size-[19px]" />
              </span>
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
