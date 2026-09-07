import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/prefs";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader, StatusBadge } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { formatDateShort, formatPrice, formatTime, statusLabel } from "@/lib/format";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { CalendarX, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const filterSchema = z.enum(["upcoming", "today", "past", "cancelled", "confirmed", "pending", "completed"]);

export const Route = createFileRoute("/_authenticated/appointments")({
  validateSearch: z.object({ new: z.boolean().optional(), filter: filterSchema.optional() }),
  head: () => ({
    meta: [
      { title: "Marcações — Schedivo" },
      { name: "description", content: "Todas as marcações do teu negócio num só lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppointmentsPage,
});

const FILTERS = ["upcoming", "today", "confirmed", "pending", "completed", "past", "cancelled"] as const;

function AppointmentsPage() {
  const { t, lang } = usePrefs();
  const search = Route.useSearch();
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(
    search.filter ?? "upcoming",
  );
  const [newOpen, setNewOpen] = useState(Boolean(search.new));

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", business?.id, filter],
    enabled: !!business,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, starts_at, customer_name, customer_phone, service_name, price_cents, status, notes")
        .eq("business_id", business!.id);
      const now = new Date().toISOString();
      if (filter === "upcoming") q = q.gte("starts_at", now).neq("status", "cancelled").order("starts_at");
      if (filter === "today") q = q.gte("starts_at", new Date(Date.now() - 12 * 3600000).toISOString()).order("starts_at");
      if (filter === "past") q = q.lt("starts_at", now).order("starts_at", { ascending: false });
      if (filter === "cancelled") q = q.eq("status", "cancelled").order("starts_at", { ascending: false });
      if (filter === "confirmed") q = q.eq("status", "confirmed").order("starts_at");
      if (filter === "pending") q = q.eq("status", "pending").order("starts_at");
      if (filter === "completed") q = q.eq("status", "completed").order("starts_at", { ascending: false });
      const { data } = await q.limit(100);
      return data ?? [];
    },
  });

  async function setStatus(id: string, status: string) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: status as never })
      .eq("id", id);
    if (error) {
      toast.error(t("appt.toast.updateError"));
      return;
    }
    await supabase.from("appointment_status_history").insert({
      appointment_id: id,
      business_id: business!.id,
      status: status as never,
    });
    toast.success(t("appt.toast.updated"));
    qc.invalidateQueries({ queryKey: ["appointments"] });
  }

  return (
    <AppShell>
      <PageHeader
        title={t("appt.page.title")}
        subtitle={t("appt.page.subtitle")}
        action={<Button onClick={() => setNewOpen(true)}>{t("appt.new")}</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`appt.filter.${f}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingRows rows={4} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<CalendarX className="size-6" />}
          title={t("appt.empty.title")}
          description={t("appt.empty.desc")}
        />
      ) : (
        <ul className="space-y-2">
          {data!.map((a) => (
            <li key={a.id} className="surface flex flex-wrap items-center gap-3 p-4">
              <div className="w-20">
                <p className="text-sm font-semibold tabular-nums">
                  {formatTime(a.starts_at, business!.timezone)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateShort(a.starts_at, business!.timezone)}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.customer_name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {a.service_name}
                  {a.customer_phone ? ` · ${a.customer_phone}` : ""}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatPrice(a.price_cents, business!.currency)}
              </span>
              <StatusBadge status={a.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t("appt.actions.label")}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {["confirmed", "completed", "no_show", "cancelled"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatus(a.id, s)}>
                      {t("appt.markAs")}{statusLabel(s, lang).toLowerCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {business && (
        <NewAppointmentDialog business={business} open={newOpen} onOpenChange={setNewOpen} />
      )}
    </AppShell>
  );
}
