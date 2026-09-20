import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/prefs";
import { AppShell } from "@/components/app-shell";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { formatDateShort, formatPrice, formatTime } from "@/lib/format";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { CalendarX, Check, ChevronLeft, ChevronRight, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AppointmentActions } from "@/components/appointment-actions";

const filterSchema = z.enum(["upcoming", "today", "past", "cancelled", "confirmed", "pending", "completed"]);

export const Route = createFileRoute("/_authenticated/appointments")({
  validateSearch: z.object({ new: z.boolean().optional(), filter: filterSchema.optional() }),
  head: () => ({
    meta: [
      { title: "Marcações — SYCRAS" },
      { name: "description", content: "Todas as marcações do teu negócio num só lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppointmentsPage,
});

const STATUS_FILTERS = ["all", "confirmed", "pending", "cancelled", "completed"] as const;
const TIME_FILTERS = ["all", "upcoming", "today", "past"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];
type TimeFilter = (typeof TIME_FILTERS)[number];

function AppointmentsPage() {
  const { t } = usePrefs();
  const search = Route.useSearch();
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const initial = search.filter;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    initial && (STATUS_FILTERS as readonly string[]).includes(initial)
      ? (initial as StatusFilter)
      : "all",
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(
    initial && (TIME_FILTERS as readonly string[]).includes(initial)
      ? (initial as TimeFilter)
      : initial
        ? "all"
        : "upcoming",
  );
  const [newOpen, setNewOpen] = useState(Boolean(search.new));
  const [overdueIdx, setOverdueIdx] = useState(0);

  const { data: overdue } = useQuery({
    queryKey: ["appointments", business?.id, "overdue"],
    enabled: !!business,
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, starts_at, customer_name, customer_phone, service_name, price_cents, status, notes")
        .eq("business_id", business!.id)
        .in("status", ["confirmed", "pending"])
        .lt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(100);
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", business?.id, statusFilter, timeFilter],
    enabled: !!business,
    queryFn: async () => {
      let q = supabase
        .from("appointments")
        .select("id, starts_at, customer_name, customer_phone, service_name, price_cents, status, notes")
        .eq("business_id", business!.id);
      const now = new Date().toISOString();
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (timeFilter === "upcoming") q = q.gte("starts_at", now);
      if (timeFilter === "today")
        q = q
          .gte("starts_at", new Date(Date.now() - 12 * 3600000).toISOString())
          .lte("starts_at", new Date(Date.now() + 12 * 3600000).toISOString());
      if (timeFilter === "past") q = q.lt("starts_at", now);
      if (statusFilter === "all" && timeFilter === "upcoming") q = q.neq("status", "cancelled");
      const descending =
        timeFilter === "past" || statusFilter === "cancelled" || statusFilter === "completed";
      q = q.order("starts_at", { ascending: !descending });
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

      {(overdue?.length ?? 0) > 0 && (
        <OverdueReview
          items={overdue!}
          idx={Math.min(overdueIdx, overdue!.length - 1)}
          setIdx={setOverdueIdx}
          timezone={business!.timezone}
          currency={business!.currency}
          onSetStatus={setStatus}
        />
      )}

      <div className="mb-4 space-y-2.5">
        <div>
          <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {t("appt.group.status")}
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  statusFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`appt.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            {t("appt.group.time")}
          </p>
          <div className="flex flex-wrap gap-2">
            {TIME_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  timeFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`appt.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>
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
            <li key={a.id} data-status={a.status} className="appointment-state surface flex flex-wrap items-center gap-3 p-4">
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
                <p className="truncate text-sm text-muted-foreground">{a.service_name}</p>
              </div>
              <AppointmentActions
                id={a.id}
                status={a.status as "pending" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired"}
                customerName={a.customer_name}
                customerPhone={a.customer_phone}
                startsAt={a.starts_at}
                serviceName={a.service_name}
                timezone={business!.timezone}
              />
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

type OverdueItem = {
  id: string;
  starts_at: string;
  customer_name: string;
  customer_phone: string | null;
  service_name: string;
  price_cents: number;
  status: string;
  notes: string | null;
};

function OverdueReview({
  items,
  idx,
  setIdx,
  timezone,
  currency,
  onSetStatus,
}: {
  items: OverdueItem[];
  idx: number;
  setIdx: (i: number) => void;
  timezone: string;
  currency: string;
  onSetStatus: (id: string, status: string) => void;
}) {
  const { t } = usePrefs();
  const a = items[idx];
  if (!a) return null;
  return (
    <section className="surface mb-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">{t("appt.overdue.title")}</h2>
          <p className="text-xs font-normal text-muted-foreground">{t("appt.overdue.desc")}</p>
        </div>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {t("appt.overdue.counter")
            .replace("{current}", String(idx + 1))
            .replace("{total}", String(items.length))}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("appt.overdue.prev")}
          disabled={idx === 0}
          onClick={() => setIdx(idx - 1)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1 rounded-2xl border border-border bg-muted/40 p-4 text-center">
          <p className="truncate text-sm font-bold">{a.customer_name}</p>
          <p className="truncate text-sm text-muted-foreground">{a.service_name}</p>
          <p className="mt-1 text-xs font-semibold tabular-nums text-muted-foreground">
            {formatDateShort(a.starts_at, timezone)} · {formatTime(a.starts_at, timezone)} ·{" "}
            {formatPrice(a.price_cents, currency)}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <Button size="sm" onClick={() => onSetStatus(a.id, "completed")}>
              <Check className="size-4" />
              {t("appt.overdue.done")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onSetStatus(a.id, "no_show")}>
              <UserX className="size-4" />
              {t("appt.overdue.noShow")}
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("appt.overdue.next")}
          disabled={idx >= items.length - 1}
          onClick={() => setIdx(idx + 1)}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>
    </section>
  );
}
