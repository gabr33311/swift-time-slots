import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getMyClientAppointments, cancelMyClientAppointment } from "@/lib/client-area.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveBar } from "@/components/save-bar";
import { usePrefs } from "@/lib/prefs";
import { PrefsToggles } from "@/components/prefs-toggles";
import { EmptyState, LoadingRows } from "@/components/ui-bits";
import { maskPhonePt, normalizePhonePt } from "@/lib/phone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTime, formatDateLong, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CalendarDays, ArrowLeft } from "lucide-react";
import { AppointmentStatusIndicator } from "@/components/appointment-status-indicator";

export const Route = createFileRoute("/_authenticated/minhas-marcacoes")({
  head: () => ({
    meta: [
      { title: "As minhas marcações — SYCRAS" },
      {
        name: "description",
        content: "Consulta e cancela as tuas marcações na tua conta SYCRAS.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyBookings,
});

type Tab = "upcoming" | "past";

function MyBookings() {
  const qc = useQueryClient();
  const fetchMine = useServerFn(getMyClientAppointments);
  const cancelMine = useServerFn(cancelMyClientAppointment);
  const [pendingCancel, setPendingCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = usePrefs();
  const [tab, setTab] = useState<Tab>("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["my-client-appointments"],
    queryFn: () => fetchMine({}),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  async function cancel(id: string) {
    setBusy(true);
    const res = await cancelMine({ data: { id } });
    setBusy(false);
    setPendingCancel(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(t("mine.toast.cancelled"));
    qc.invalidateQueries({ queryKey: ["my-client-appointments"] });
  }

  const all = data ?? [];
  const now = Date.now();
  const isUpcoming = (a: (typeof all)[number]) =>
    new Date(a.starts_at).getTime() > now && a.status !== "cancelled";
  const list = all
    .filter((a) => (tab === "upcoming" ? isUpcoming(a) : !isUpcoming(a)))
    .sort((a, b) =>
      tab === "upcoming"
        ? a.starts_at.localeCompare(b.starts_at)
        : b.starts_at.localeCompare(a.starts_at),
    );

  return (
    <main className="animate-enter mx-auto w-full max-w-2xl px-5 py-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> {t("mine.back")}
      </Link>
      <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">
        {t("mine.title")}
      </h1>

      <ClientProfileCard />

      <div className="mt-8 flex items-center gap-1 rounded-2xl border border-border bg-muted/40 p-1">
        {(
          [
            ["upcoming", t("mine.tab.upcoming")],
            ["past", t("mine.tab.past")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors",
              tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <LoadingRows />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title={tab === "upcoming" ? t("mine.empty.upcoming") : t("mine.empty.past")}
            description={t("mine.empty.desc")}
          />
        ) : (
          <ul className="space-y-2.5">
            {list.map((a) => {
              const tz = a.business?.timezone ?? "Europe/Lisbon";
              return (
                <li key={a.id} data-status={a.status} className="appointment-state surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold">{a.service_name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.business?.name ?? ""}
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {formatDateLong(a.starts_at, tz)} · {formatTime(a.starts_at, tz)}
                      </p>
                    </div>
                    <AppointmentStatusIndicator status={a.status} />
                  </div>
                  {tab === "upcoming" && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingCancel(a.id)}
                        disabled={busy}
                      >
                        {t("mine.cancel")}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={!!pendingCancel} onOpenChange={(o) => !o && setPendingCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("mine.dialog.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("mine.dialog.cancelDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("mine.dialog.keep")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingCancel && cancel(pendingCancel)}>
              {t("mine.cancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function ClientProfileCard() {
  const { t } = usePrefs();
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [saved, setSaved] = useState({ full_name: "", phone: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        const next = {
          full_name: data?.full_name ?? (user.user_metadata?.["full_name"] as string) ?? "",
          phone: maskPhonePt(data?.phone ?? ""),
        };
        setForm(next);
        setSaved(next);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: form.full_name.trim() || null,
      phone: form.phone ? normalizePhonePt(form.phone) : null,
    });
    setBusy(false);
    if (error) {
      toast.error(t("mine.toast.saveError"));
      return;
    }
    setSaved(form);
    toast.success(t("mine.toast.saved"));
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  return (
    <section className="surface mt-6 space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground">
            {initials(form.full_name || user?.email || "C")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{form.full_name || t("mine.profile.clientFallback")}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <PrefsToggles />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cn" className="font-semibold">
            {t("mine.profile.name")}
          </Label>
          <Input
            id="cn"
            value={form.full_name}
            maxLength={80}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp" className="font-semibold">
            {t("mine.profile.phone")}
          </Label>
          <Input
            id="cp"
            inputMode="tel"
            value={form.phone}
            placeholder="912 345 678"
            onChange={(e) => setForm((f) => ({ ...f, phone: maskPhonePt(e.target.value) }))}
          />
        </div>
      </div>

      <SaveBar dirty={dirty} busy={busy} onSave={save} onCancel={() => setForm(saved)} />
    </section>
  );
}
