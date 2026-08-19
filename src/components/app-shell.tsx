import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  UserRound,
  Clock,
  ListPlus,
  BarChart3,
  Share2,
  Settings,
  Menu,
  Plus,
  LogOut,
  Bell,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { useMyBusiness } from "@/hooks/use-business";
import { useQuery } from "@tanstack/react-query";

const NAV = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/calendar", label: "Agenda", icon: CalendarDays },
  { to: "/appointments", label: "Marcações", icon: Clock },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/services", label: "Serviços", icon: Scissors },
  { to: "/team", label: "Equipa", icon: UserRound },
  { to: "/availability", label: "Disponibilidade", icon: Clock },
  { to: "/waitlist", label: "Lista de espera", icon: ListPlus },
  { to: "/analytics", label: "Estatísticas", icon: BarChart3 },
  { to: "/booking-page", label: "Partilhar", icon: Share2 },
  { to: "/settings", label: "Definições", icon: Settings },
] as const;

const MOBILE_NAV = [
  { to: "/dashboard", label: "Hoje", icon: LayoutDashboard },
  { to: "/calendar", label: "Agenda", icon: CalendarDays },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/booking-page", label: "Partilhar", icon: Share2 },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { business } = useMyBusiness();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: unread } = useQuery({
    queryKey: ["unread-notifications", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id)
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const brand = (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
        {business ? initials(business.name) : "M"}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{business?.name ?? "Marca"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {business ? `/${business.slug}` : "A carregar…"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar px-3 py-4 lg:flex">
        <div className="px-2 pb-4">{brand}</div>
        <NavList />
        <div className="mt-auto px-1 pt-4">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="size-4" /> Terminar sessão
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <div className="pb-4">{brand}</div>
              <NavList onNavigate={() => setOpen(false)} />
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 w-full justify-start gap-3"
                onClick={signOut}
              >
                <LogOut className="size-4" /> Terminar sessão
              </Button>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">{brand}</div>

          <div className="ml-auto flex items-center gap-1">
            <Link to="/appointments" aria-label="Notificações">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="size-5" />
                {(unread ?? 0) > 0 && (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
                )}
              </Button>
            </Link>
            <Link to="/appointments" search={{ new: true }} className="hidden sm:block">
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" /> Nova marcação
              </Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:pb-12">{children}</main>
      </div>

      <Link
        to="/appointments"
        search={{ new: true }}
        className="fixed bottom-20 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-lift)] sm:hidden"
        aria-label="Nova marcação"
      >
        <Plus className="size-6" />
      </Link>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
