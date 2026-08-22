import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { displayCustomerName, formatPrice, formatTime } from "@/lib/format";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppointmentActions } from "@/components/appointment-actions";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Agenda — Schedivo" },
      { name: "description", content: "A agenda diária da tua equipa, hora a hora." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { business } = useMyBusiness();
  const tz = business?.timezone ?? "Europe/Lisbon";
  const [date, setDate] = useState(todayIn(tz));
  const [newOpen, setNewOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", business?.id, date],
    enabled: !!business,
    queryFn: async () => {
      const from = zonedToUtc(date, 0, tz).toISOString();
      const to = zonedToUtc(date, 24 * 60, tz).toISOString();
      const [{ data: appts }, { data: staff }] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, starts_at, ends_at, customer_name, service_name, price_cents, status, staff_id")
          .eq("business_id", business!.id)
          .gte("starts_at", from)
          .lt("starts_at", to)
          .neq("status", "cancelled")
          .order("starts_at"),
        supabase
          .from("staff")
          .select("id, name")
          .eq("business_id", business!.id)
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      return { appts: appts ?? [], staff: staff ?? [] };
    },
  });

  const label = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <AppShell>
      <PageHeader
        title="Agenda"
        subtitle="O dia da tua equipa."
        action={
          <Button className="hidden lg:inline-flex" onClick={() => setNewOpen(true)}>
            Nova marcação
          </Button>
        }
      />

      <div className="surface mb-5 flex items-center gap-1 p-1.5">
        <button
          onClick={() => setDate(addDays(date, -1))}
          aria-label="Dia anterior"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-bold capitalize">{label}</p>
        <button
          onClick={() => setDate(addDays(date, 1))}
          aria-label="Dia seguinte"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          onClick={() => setDate(todayIn(tz))}
          className={cn(
            "ml-0.5 h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold transition-colors",
            date === todayIn(tz)
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Hoje
        </button>
      </div>

      {isLoading ? (
        <LoadingRows rows={5} />
      ) : (data?.appts.length ?? 0) === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title="Dia livre."
          description="Não há marcações para este dia."
        />
      ) : (
        <div className="space-y-6">
          {(data!.staff.length ? data!.staff : [{ id: "none", name: "Marcações" }]).map((member) => {
            const items = data!.appts.filter((a) =>
              member.id === "none" ? true : a.staff_id === member.id,
            );
            if (items.length === 0) return null;
            return (
              <section key={member.id}>
                <h2 className="font-display mb-2.5 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  {member.name}
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                    {items.length}
                  </span>
                </h2>
                <ul className="space-y-2.5">
                  {items.map((a, i) => (
                    <li key={a.id} className={cn("surface surface-hover flex items-center gap-3.5 p-4")}>
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-accent px-2 py-2 text-sm font-bold leading-tight tabular-nums text-primary">
                        {formatTime(a.starts_at, tz)}
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {formatTime(a.ends_at, tz)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold leading-snug">
                          {displayCustomerName(a.customer_name, null, i + 1)}
                        </p>
                        <p className="truncate text-sm font-normal leading-snug text-muted-foreground">
                          {a.service_name}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-sm font-bold tabular-nums">
                          {formatPrice(a.price_cents, business!.currency)}
                        </span>
                        <StatusBadge status={a.status} />
                      </div>
                      <AppointmentActions
                        id={a.id}
                        status={a.status}
                        customerName={displayCustomerName(a.customer_name, null, i + 1)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {mounted &&
        createPortal(
          <button
            onClick={() => setNewOpen(true)}
            aria-label="Nova marcação"
            className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform active:scale-95 lg:hidden"
          >
            <Plus className="size-6" strokeWidth={2.6} />
          </button>,
          document.body,
        )}

      {business && (
        <NewAppointmentDialog
          business={business}
          open={newOpen}
          onOpenChange={setNewOpen}
          defaultDate={date}
        />
      )}
    </AppShell>
  );
}
