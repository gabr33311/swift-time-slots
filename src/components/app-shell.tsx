import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Users, Store, LogOut } from "lucide-react";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useMyBusiness } from "@/hooks/use-business";
import { useLogoUrl } from "@/hooks/use-logo";

const NAV = [
  { to: "/dashboard", label: "Hoje", icon: LayoutDashboard },
  { to: "/calendar", label: "Agenda", icon: CalendarDays },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/profile", label: "Perfil", icon: Store },
] as const;

function NavList() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-all hover:translate-x-0.5",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon
              key={active ? `${item.to}-on` : `${item.to}-off`}
              className={cn("size-4", active && "animate-icon-pop")}
              strokeWidth={2.5}
            />
            {item.label}
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

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: undefined } });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`Foto de ${business?.name ?? "perfil"}`}
              className="size-9 rounded-xl object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
              {business ? initials(business.name) : "S"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{business?.name ?? "Schedivo"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {business ? `/${business.slug}` : "A carregar…"}
            </p>
          </div>
        </div>
        <NavList />
        <div className="mt-auto px-1 pt-4">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="size-4" /> Terminar sessão
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <main className="animate-enter mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:pb-12">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon
                key={active ? `${item.to}-on` : `${item.to}-off`}
                className={cn("size-5", active && "animate-icon-pop")}
                strokeWidth={2.5}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
