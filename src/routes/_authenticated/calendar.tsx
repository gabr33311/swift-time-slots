import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { formatPrice, formatTime } from "@/lib/format";
import { addDays, todayIn, zonedToUtc } from "@/lib/time";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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

      <div className="mb-5 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Dia seguinte">
          <ChevronRight className="size-4" />
        </Button>
        <p className="ml-1 text-sm font-medium capitalize">{label}</p>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setDate(todayIn(tz))}>
          Hoje
        </Button>
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
                <h2 className="mb-2 inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-accent-foreground">
                  {member.name}
                  <span className="rounded-full bg-background/60 px-2 text-xs font-bold tabular-nums">
                    {items.length}
                  </span>
                </h2>
                <ul className="space-y-2">
                  {items.map((a, i) => (
                    <li key={a.id} className={cn("surface flex items-start gap-3 p-4")}>
                      <span className="w-[4.5rem] shrink-0 text-sm font-bold leading-snug tabular-nums">
                        {formatTime(a.starts_at, tz)}
                        <br />
                        <span className="text-muted-foreground">{formatTime(a.ends_at, tz)}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-snug break-words">
                          {displayCustomerName(a.customer_name, null, i + 1)}
                        </p>
                        <p className="text-sm leading-snug text-muted-foreground break-words">
                          {a.service_name}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold tabular-nums">
                            {formatPrice(a.price_cents, business!.currency)}
                          </span>
                          <StatusBadge status={a.status} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setNewOpen(true)}
        aria-label="Nova marcação"
        className="fixed bottom-20 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 lg:hidden"
      >
        <Plus className="size-6" strokeWidth={2.6} />
      </button>

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
