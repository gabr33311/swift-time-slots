import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  getBookingByToken,
  cancelBookingByToken,
  rescheduleBookingByToken,
  getAvailableSlots,
} from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui-bits";
import { formatDateLong, formatPrice, formatTime } from "@/lib/format";
import { addDays, todayIn } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CalendarClock, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/booking/$token")({
  loader: async ({ params }) => {
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
  const [date, setDate] = useState(todayIn(initial.business?.timezone ?? "Europe/Lisbon"));
  const [busy, setBusy] = useState(false);

  const appt = data.appointment;
  const tz = data.business?.timezone ?? "Europe/Lisbon";

  const { data: slots, isFetching } = useQuery({
    queryKey: ["reschedule-slots", appt.id, date],
    enabled: rescheduling && !!appt.service_id,
    queryFn: async () =>
      await getAvailableSlots({
        data: {
          businessId: appt.business_id,
          serviceId: appt.service_id!,
          staffId: appt.staff_id,
          date,
        },
      }),
  });

  async function cancel() {
    setBusy(true);
    try {
      const res = await cancelBookingByToken({ data: { token } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setData({ ...data, appointment: { ...appt, status: "cancelled" } });
      toast.success(t("bk.tk.cancelled"));
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(time: string) {
    setBusy(true);
    try {
      const res = await rescheduleBookingByToken({ data: { token, date, time } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const fresh = await getBookingByToken({ data: { token } });
      if (fresh) setData(fresh);
      setRescheduling(false);
      toast.success(t("bk.tk.rescheduled"));
    } finally {
      setBusy(false);
    }
  }

  const cancelled = appt.status === "cancelled";
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayIn(tz), i));

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <p className="text-sm text-muted-foreground">{data.business?.name}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("bk.tk.title")}</h1>

      <div className="surface mt-6 p-5">
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
          <StatusBadge status={appt.status} />
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

      {!cancelled && (
        <div className="mt-8 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setRescheduling((v) => !v)}>
            <CalendarClock className="mr-2 size-4" />
            {rescheduling ? t("bk.tk.close") : t("bk.tk.reschedule")}
          </Button>
          <Button variant="ghost" onClick={cancel} disabled={busy}>
            {t("bk.tk.cancel")}
          </Button>
        </div>
      )}

      {rescheduling && !cancelled && (
        <section className="mt-6">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center rounded-xl border border-border px-2 py-2.5 text-sm",
                  date === d && "border-primary bg-primary text-primary-foreground",
                )}
              >
                <span className="text-xs uppercase">
                  {new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-PT", { weekday: "short", timeZone: tz }).format(
                    new Date(`${d}T12:00:00Z`),
                  )}
                </span>
                <span className="text-base font-semibold tabular-nums">
                  {new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pt-PT", { day: "2-digit", timeZone: tz }).format(
                    new Date(`${d}T12:00:00Z`),
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {isFetching
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)
              : (slots ?? []).map((s) => (
                  <button
                    key={s.time}
                    disabled={busy}
                    onClick={() => reschedule(s.time)}
                    className="rounded-lg border border-border py-2.5 text-sm font-medium tabular-nums hover:bg-accent"
                  >
                    {s.time}
                  </button>
                ))}
          </div>
          {!isFetching && (slots?.length ?? 0) === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">{t("bk.tk.noSlots")}</p>
          )}
        </section>
      )}

      <p className="mt-10 text-xs text-muted-foreground">
        {t("bk.tk.policy1")}{data.business?.cancellation_hours ?? 24}{t("bk.tk.policy2")}
      </p>
    </main>
  );
}
