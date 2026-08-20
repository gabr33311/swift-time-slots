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
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Agenda — Marca" },
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
        action={<Button onClick={() => setNewOpen(true)}>Nova marcação</Button>}
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
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{member.name}</h2>
                <ul className="space-y-2">
                  {items.map((a) => (
                    <li key={a.id} className={cn("surface flex items-center gap-4 p-4")}>
                      <span className="w-24 text-sm font-semibold tabular-nums">
                        {formatTime(a.starts_at, tz)}–{formatTime(a.ends_at, tz)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.customer_name}</p>
                        <p className="truncate text-sm text-muted-foreground">{a.service_name}</p>
                      </div>
                      <span className="text-sm font-medium tabular-nums">
                        {formatPrice(a.price_cents, business!.currency)}
                      </span>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
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
