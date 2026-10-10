import { usePrefs } from "@/lib/prefs";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getBookingByToken,
  cancelBookingByToken,
  rescheduleBookingByToken,
  getRescheduleSlots,
} from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentStatusIndicator } from "@/components/appointment-status-indicator";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import { addDays, todayIn } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CalendarClock, Check, Loader2, MapPin, Phone } from "lucide-react";
import { AddToCalendar } from "@/components/add-to-calendar";
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

export const Route = createFileRoute("/booking/$token")({
  loader: async ({ params }) => {
    // Malformed links are simply unknown bookings, not server errors.
    if (params.token.trim().length !== 48) throw notFound();
    const data = await getBookingByToken({ data: { token: params.token } });
    if (!data) throw notFound();
    return data;
  },
  head: () => ({
    meta: [
      { title: "A minha marcação" },
      { name: "description", content: "Consulta, reagenda ou cancela a tua marcação." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => (
    <MessageT titleKey="bk.tk.errorTitle" bodyKey="bk.tk.errorBody" />
  ),
  notFoundComponent: () => (
    <MessageT titleKey="bk.tk.invalidTitle" bodyKey="bk.tk.invalidBody" />
  ),
  component: BookingPage,
});

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </main>
  );
}

function MessageT({ titleKey, bodyKey }: { titleKey: string; bodyKey: string }) {
  const { t } = usePrefs();
  return <Message title={t(titleKey)} body={t(bodyKey)} />;
}

function BookingPage() {
  const { t, lang } = usePrefs();
  const { token } = Route.useParams();
  const initial = Route.useLoaderData();
  const [data, setData] = useState(initial);
  const [rescheduling, setRescheduling] = useState(false);
  const tz0 = initial.business?.timezone ?? "Europe/Lisbon";
  const [date, setDate] = useState(todayIn(tz0));
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appt = data.appointment;
  const tz = data.business?.timezone ?? "Europe/Lisbon";

  const { data: slots, isFetching, isError: slotsError, refetch } = useQuery({
    queryKey: ["reschedule-slots", appt.id, appt.starts_at, date],
    enabled: rescheduling && !!appt.service_id,
    retry: 1,
    queryFn: async () => await getRescheduleSlots({ data: { token, date } }),
  });

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await cancelBookingByToken({ data: { token } });
      if (!res.ok) {
        setConfirmCancel(false);
        setError(res.message);
        return;
      }
      setConfirmCancel(false);
      setRescheduling(false);
      setData({ ...data, appointment: { ...appt, status: "cancelled" } });
      toast.success(t("bk.tk.cancelled"));
    } catch {
      setConfirmCancel(false);
      setError(t("bk.tk.err.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!pickedTime) return;
    setBusy(true);
    setError(null);
    try {
      const res = await rescheduleBookingByToken({ data: { token, date, time: pickedTime } });
      if (!res.ok) {
        setError(res.message);
        setPickedTime(null);
        void refetch();
        return;
      }
      const fresh = await getBookingByToken({ data: { token } });
      if (fresh) setData(fresh);
      setRescheduling(false);
      setPickedTime(null);
      toast.success(t("bk.tk.rescheduled"));
    } catch {
      setError(t("bk.tk.err.generic"));
    } finally {
      setBusy(false);
    }
  }

  function toggleRescheduling() {
    setError(null);
    setPickedTime(null);
    if (!rescheduling) {
      // Start on the current booking's day when it is within the visible range.
      const current = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(appt.starts_at));
      setDate(current >= todayIn(tz) && current <= addDays(todayIn(tz), 13) ? current : todayIn(tz));
    }
    setRescheduling((v) => !v);
  }

  const cancelled = appt.status === "cancelled";
  // Only upcoming (pending/confirmed) bookings can still be changed by the client.
  const manageable = appt.status === "pending" || appt.status === "confirmed";
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayIn(tz), i));
  const locale = lang === "en" ? "en-GB" : "pt-PT";

  return (
    <main className="mx-auto max-w-lg px-5 py-10 sm:py-16">
      {manageable && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <div className="min-w-0">
            <p className="font-bold">{t(appt.status === "pending" ? "bk.pending.title" : "bk.confirmed.title")}</p>
            <p className="text-xs text-muted-foreground">{t(appt.status === "pending" ? "bk.pending.manage" : "bk.confirmed.manage")}</p>
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{data.business?.name}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("bk.tk.title")}</h1>

      <div data-status={appt.status} className="appointment-state surface mt-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-medium">{appt.service_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateLong(appt.starts_at, tz)}{t("bk.tk.at")}{formatTime(appt.starts_at, tz)}
            </p>
            {data.staffName && (
              <p className="mt-0.5 text-sm text-muted-foreground">{t("bk.tk.with")}{data.staffName}</p>
            )}
          </div>
          <AppointmentStatusIndicator status={appt.status} />
        </div>
        <p className="mt-4 text-sm font-semibold tabular-nums">
          {formatPrice(appt.price_cents)}
        </p>
      </div>

      {data.business && (
        <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
          {data.business.address && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4" /> {data.business.address}
              {data.business.city ? `, ${data.business.city}` : ""}
            </p>
          )}
          {data.business.phone && (
            <a href={`tel:${data.business.phone}`} className="flex items-center gap-2">
              <Phone className="size-4" /> {data.business.phone}
            </a>
          )}
        </div>
      )}

      {manageable && (
        <AddToCalendar
          event={{
            title: `${appt.service_name} · ${data.business?.name ?? ""}`,
            description: appt.service_name,
            location: [data.business?.address, data.business?.city].filter(Boolean).join(", "),
            startIso: appt.starts_at,
            endIso: appt.ends_at ?? appt.starts_at,
          }}
        />
      )}

      {cancelled && data.business?.slug && (
        <Link
          to="/$slug"
          params={{ slug: data.business.slug }}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
        >
          {t("bk.tk.bookAgain")}
        </Link>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive">
          {error}
        </p>
      )}

      {manageable && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant={rescheduling ? "secondary" : "outline"} onClick={toggleRescheduling} disabled={busy}>
            <CalendarClock className="mr-2 size-4" />
            {rescheduling ? t("bk.tk.close") : t("bk.tk.reschedule")}
          </Button>
          <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={busy}>
            {t("bk.tk.cancel")}
          </Button>
        </div>
      )}

      {rescheduling && manageable && (
        <section className="mt-6 animate-enter">
          <p className="mb-2 text-sm font-bold">{t("bk.tk.pickNew")}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDate(d);
                  setPickedTime(null);
                }}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center rounded-xl border border-border px-2 py-2.5 text-sm transition-colors",
                  date === d ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                <span className="text-xs uppercase">
                  {new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
                    new Date(`${d}T12:00:00Z`),
                  )}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone: "UTC" }).format(
                    new Date(`${d}T12:00:00Z`),
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="animate-stagger mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {isFetching
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-lg" />)
              : (slots ?? []).map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    disabled={busy}
                    onClick={() => setPickedTime(s.time)}
                    className={cn(
                      "rounded-lg border py-3 text-sm font-bold tabular-nums transition-colors",
                      pickedTime === s.time
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    {s.time}
                  </button>
                ))}
          </div>
          {!isFetching && slotsError && (
            <div className="mt-4 flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{t("bk.err.slots")}</span>
              <button type="button" onClick={() => void refetch()} className="font-bold underline">
                {t("bk.retry")}
              </button>
            </div>
          )}
          {!isFetching && !slotsError && (slots?.length ?? 0) === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">{t("bk.tk.noSlots")}</p>
          )}
          {pickedTime && (
            <Button className="mt-4 w-full" size="lg" onClick={() => void reschedule()} disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("bk.tk.confirmMove")
                .replace("{date}", formatDateLong(`${date}T12:00:00Z`, tz))
                .replace("{time}", pickedTime)}
            </Button>
          )}
        </section>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={(o) => !busy && setConfirmCancel(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bk.tk.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {appt.service_name} · {formatDateLong(appt.starts_at, tz)} · {formatTime(appt.starts_at, tz)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("bk.tk.keep")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void cancel();
              }}
            >
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("bk.tk.cancelYes")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-10 text-xs text-muted-foreground">
        {t("bk.tk.policy1")}{data.business?.cancellation_hours ?? 24}{t("bk.tk.policy2")}
      </p>
    </main>
  );
}
