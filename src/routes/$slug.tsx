import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";
import { getPublicBusiness, getAvailableSlots, createPublicBooking } from "@/lib/booking.functions";
import { trackPageView } from "@/lib/analytics.functions";
import { AddToCalendar } from "@/components/add-to-calendar";
import { maskPhonePt } from "@/lib/phone";
import { isReservedSlug } from "@/lib/reserved-slugs";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatPrice, formatDateLong, initials } from "@/lib/format";
import { addMonthsClamped, todayIn, zonedToUtc, timeToMinutes, weekdayOf } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Instagram,
  MapPin,
  Phone,
} from "lucide-react";


export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    if (isReservedSlug(params.slug)) throw notFound();
    const data = await getPublicBusiness({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Página não encontrada" }, { name: "robots", content: "noindex" }] };
    }
    const b = loaderData.business;
    const title = `Marcar em ${b.name}${b.city ? ` · ${b.city}` : ""}`;
    const description =
      b.description?.slice(0, 155) ??
      `Escolhe o serviço e o horário e marca online em ${b.name}. Confirmação imediata.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(b.seo_indexable ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  errorComponent: () => <ErrorMessage />,
  notFoundComponent: () => <NotFoundMessage />,
  component: BookPage,
});

function CenteredMessage({ title, body }: { title: string; body: string }) {
  const { t } = usePrefs();
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary underline">
          {t("bk.backHome")}
        </Link>
      </div>
    </main>
  );
}

function ErrorMessage() {
  const { t } = usePrefs();
  return <CenteredMessage title={t("bk.error.title")} body={t("bk.error.body")} />;
}

function NotFoundMessage() {
  const { t } = usePrefs();
  return <CenteredMessage title={t("bk.notFound.title")} body={t("bk.notFound.body")} />;
}

function makeFormSchema(t: (key: string) => string) {
  const nameError = t("bk.validation.name");
  const phoneError = t("bk.validation.phone");
  const emailError = t("bk.validation.email");
  return z.object({
    name: z.string().trim().min(2, nameError).max(80),
    phone: z
      .string()
      .trim()
      .min(6, phoneError)
      .max(24)
      .regex(/^[0-9+\s()-]+$/, phoneError),
    email: z.string().trim().min(1, emailError).email(emailError).max(160),
    notes: z.string().trim().max(500),
  });
}

function BookPage() {
  const { t } = usePrefs();
  const { business, services, staff, openWeekdays, blocks } = Route.useLoaderData();
  // A day is closed if it is a weekly day off or fully covered by a business-wide block (vacation).
  const isClosedDay = (d: string) => {
    if (!openWeekdays.includes(weekdayOf(d))) return true;
    const start = zonedToUtc(d, 0, business.timezone).getTime();
    const end = zonedToUtc(d, 24 * 60, business.timezone).getTime();
    return blocks.some((b) => new Date(b.from).getTime() <= start + 60000 && new Date(b.to).getTime() >= end - 60000);
  };
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(
    staff.length === 1 ? staff[0]!.id : null,
  );
  const today = todayIn(business.timezone);
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ token: string; status: string } | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  // Field errors shown under each input, so the client sees exactly what to fix.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"name" | "phone" | "email", string | undefined>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stepKeys = useMemo<readonly string[]>(
    () =>
      staff.length > 1
        ? ["staff", "service", "day", "time", "account"]
        : ["service", "day", "time", "account"],
    [staff.length],
  );
  const safeIdx = Math.min(stepIdx, stepKeys.length - 1);
  const currentStep = stepKeys[safeIdx]!;
  const stepNumber = safeIdx + 1;
  const goNext = () => setStepIdx((i) => Math.min(i + 1, stepKeys.length - 1));
  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));
  const goTo = (key: string) => {
    const i = stepKeys.indexOf(key);
    if (i >= 0) setStepIdx(i);
  };

  const service = services.find((s) => s.id === serviceId) ?? null;
  const visibleServices = useMemo(() => {
    const person = staffId ? staff.find((p) => p.id === staffId) : null;
    if (!person) return services;
    // Same rule as the server: a service nobody is linked to can be done by anyone.
    const linked = new Set(staff.flatMap((p) => p.service_ids));
    return services.filter((s) => person.service_ids.includes(s.id) || !linked.has(s.id));
  }, [services, staff, staffId]);


  const monthDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y!, m! - 1, 1));
    const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${month}-${String(d).padStart(2, "0")}`);
    }
    return cells;
  }, [month]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const label = new Intl.DateTimeFormat("pt-PT", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y!, m! - 1, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [month]);

  // Farthest date a client may book (admin-configurable, in months).
  const maxDate = useMemo(
    () => addMonthsClamped(today, business.booking_horizon_months ?? 2),
    [today, business.booking_horizon_months],
  );

  function shiftMonth(delta: number) {
    const [y, m] = month.split("-").map(Number);
    const next = new Date(Date.UTC(y!, m! - 1 + delta, 1));
    setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const { data: slots, isFetching, isError: slotsError, refetch: refetchSlots } = useQuery({
    queryKey: ["slots", business.id, serviceId, staffId, date],
    enabled: !!serviceId,
    retry: 1,
    queryFn: async () => {
      try {
        return await getAvailableSlots({
          data: { businessId: business.id, serviceId: serviceId!, staffId, date },
        });
      } catch (e) {
        console.error("[slots] failed to load availability", e);
        throw e;
      }
    },
  });


  // One view per browser session (refreshes don't count again).
  useEffect(() => {
    let sid = sessionStorage.getItem("sycras-sid");
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("sycras-sid", sid);
    }
    const key = `sycras-view-${business.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void trackPageView({ data: { businessId: business.id, sessionId: sid } }).catch(() => {});
  }, [business.id]);

  async function submit() {
    const parsed = makeFormSchema(t).safeParse({ name, phone, email, notes });
    if (!parsed.success) {
      const errs: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof fieldErrors;
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      setSubmitError(null);
      return;
    }
    if (!serviceId || !time) return;
    setFieldErrors({});
    setSubmitError(null);
    setBusy(true);
    try {
      const res = await createPublicBooking({
        data: {
          businessId: business.id,
          serviceId,
          staffId,
          date,
          time,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          notes: parsed.data.notes,
        },
      });
      if (!res.ok) {
        if (res.code === "slot_taken") {
          // Someone took that time meanwhile: send the client straight back to pick another.
          toast.error(t("bk.err.slotTaken"));
          setTime(null);
          goTo("time");
          void refetchSlots();
          return;
        }
        setSubmitError(res.message);
        return;
      }
      setDone({ token: res.token, status: res.status });
      void navigate({ to: "/booking/$token", params: { token: res.token }, replace: true });
    } catch (e) {
      console.error("[booking] failed", e);
      const msg = e instanceof Error ? e.message : "";
      setSubmitError(
        msg.includes("SUPABASE_SERVICE_ROLE_KEY") || msg.includes("Missing Supabase")
          ? t("bk.err.server")
          : t("bk.toast.bookingFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const startsAt =
      time && service ? zonedToUtc(date, timeToMinutes(time), business.timezone) : null;
    const endsAt =
      startsAt && service
        ? new Date(startsAt.getTime() + service.duration_minutes * 60000)
        : null;
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="surface p-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary">
            <Check className="size-7" />
          </div>
          <h1 className="text-xl font-bold">
            {t(done.status === "pending" ? "bk.pending.title" : "bk.confirmed.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDateLong(`${date}T12:00:00Z`, business.timezone)}{t("bk.confirmed.at")}{time} · {service?.name}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {t(done.status === "pending" ? "bk.pending.manage" : "bk.confirmed.manage")}
          </p>
          <Link
            to="/booking/$token"
            params={{ token: done.token }}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            {t("bk.viewDetails")}
          </Link>

          {startsAt && endsAt && service && (
            <AddToCalendar
              event={{
                title: `${service.name} · ${business.name}`,
                description: t("bk.calendar.title") + business.name + ".",
                location: [business.address, business.city].filter(Boolean).join(", "),
                startIso: startsAt.toISOString(),
                endIso: endsAt.toISOString(),
              }}
            />
          )}
        </div>
      </main>
    );
  }


  return (
    <main
      className={cn(
        "mx-auto flex min-h-dvh max-w-2xl flex-col px-5 pt-6",
        // Leave room so the fixed confirm bar never hides the last fields.
        currentStep === "account" ? "pb-48" : "pb-6",
      )}
    >
      <header className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          {business.logo_url ? (
            <img
              src={business.logo_url}
              alt={t("bk.logoAlt") + business.name}
              className="size-full rounded-xl object-cover"
            />
          ) : (
            initials(business.name)
          )}
        </div>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold leading-tight tracking-tight">
          {business.name}
        </h1>
        {business.show_contacts && business.phone && (
          <a
            href={`tel:${business.phone}`}
            aria-label={business.phone}
            className="text-muted-foreground hover:text-foreground"
          >
            <Phone className="size-4" />
          </a>
        )}
      </header>

      {safeIdx > 0 && (
        <div className="mt-6 mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-bold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {t("bk.back")}
          </button>
          {/* What's chosen so far; tapping a choice jumps straight back to change it. */}
          {staffId && staff.length > 1 && safeIdx > stepKeys.indexOf("staff") && (
            <SummaryChip onClick={() => goTo("staff")}>
              {staff.find((p) => p.id === staffId)?.name}
            </SummaryChip>
          )}
          {service && safeIdx > stepKeys.indexOf("service") && (
            <SummaryChip onClick={() => goTo("service")}>{service.name}</SummaryChip>
          )}
          {safeIdx > stepKeys.indexOf("day") && (
            <SummaryChip onClick={() => goTo("day")}>
              {formatDateLong(`${date}T12:00:00Z`, business.timezone)}
            </SummaryChip>
          )}
          {time && safeIdx > stepKeys.indexOf("time") && (
            <SummaryChip onClick={() => goTo("time")}>{time}</SummaryChip>
          )}
        </div>
      )}

      <div key={currentStep} className="animate-enter flex flex-col py-4">
      {currentStep === "staff" && (
        <Section step={stepNumber} total={stepKeys.length} title={t("bk.step.staff")}>
          <div className="animate-stagger grid gap-2 sm:grid-cols-2">
            {staff.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setStaffId(p.id);
                  setServiceId(null);
                  setTime(null);
                  goNext();
                }}
                className={cn(
                  "surface surface-hover flex items-center gap-3 border-2 p-4 text-left transition-all",
                  staffId === p.id ? "border-primary bg-primary/5 shadow-lift" : "border-transparent",
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {initials(p.name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{p.name}</span>
                  {p.specialty && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.specialty}
                    </span>
                  )}
                </span>
              </button>
            ))}
            <button
              onClick={() => {
                setStaffId(null);
                setServiceId(null);
                setTime(null);
                goNext();
              }}
              className="surface surface-hover border-2 border-transparent p-4 text-left text-sm font-bold"
            >
              {t("bk.step.anyStaff")}
            </button>
          </div>
        </Section>
      )}

      {currentStep === "service" && (
        <Section step={stepNumber} total={stepKeys.length} title={t("bk.step.service")}>
          <div className="animate-stagger grid gap-2 sm:grid-cols-2">
            {visibleServices.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setTime(null);
                  goNext();
                }}
                className={cn(
                  "surface surface-hover flex items-center justify-between gap-4 border-2 p-4 text-left transition-all",
                  serviceId === s.id
                    ? "border-primary bg-primary/5 shadow-lift"
                    : "border-transparent",
                )}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{s.name}</span>
                  {s.description && (
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {s.description}
                    </span>
                  )}
                  <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" /> {formatDuration(s.duration_minutes)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {formatPrice(s.price_cents, business.currency)}
                </span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {currentStep === "day" && (
        <Section step={stepNumber} total={stepKeys.length} title={t("bk.step.day")}>
          <div className="rounded-2xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("bk.prevMonth")}
                disabled={month <= today.slice(0, 7)}
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-bold">{monthLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("bk.nextMonth")}
                disabled={month >= maxDate.slice(0, 7)}
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
              {[
                t("bk.weekday.mon"),
                t("bk.weekday.tue"),
                t("bk.weekday.wed"),
                t("bk.weekday.thu"),
                t("bk.weekday.fri"),
                t("bk.weekday.sat"),
                t("bk.weekday.sun"),
              ].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthDays.map((d, i) => {
                if (!d) return <span key={`e${i}`} />;
                const past = d < today || d > maxDate || isClosedDay(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={past}
                    onClick={() => {
                      setDate(d);
                      setTime(null);
                      goNext();
                    }}
                    className={cn(
                      "mx-auto flex size-10 items-center justify-center rounded-full text-sm font-bold tabular-nums transition-colors",
                      past && "cursor-not-allowed font-medium text-muted-foreground/35 line-through",
                      !past && date !== d && "hover:bg-accent",
                      date === d && "bg-primary text-primary-foreground shadow-lift",
                    )}
                  >
                    {Number(d.slice(-2))}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {currentStep === "time" && (
        <Section
          step={stepNumber}
          total={stepKeys.length}
          title={t("bk.step.time")}
          subtitle={formatDateLong(`${date}T12:00:00Z`, business.timezone)}
        >
          {isFetching ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : slotsError ? (
            <div className="surface flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm font-bold">{t("bk.err.slots")}</p>
              <button
                type="button"
                onClick={() => void refetchSlots()}
                className="rounded-full border border-border px-4 py-2 text-sm font-bold hover:bg-accent"
              >
                {t("bk.retry")}
              </button>
            </div>
          ) : (slots?.length ?? 0) === 0 ? (
            <div className="surface flex flex-col items-center gap-2 p-8 text-center">
              <CalendarDays className="size-5 text-muted-foreground" />
              <p className="text-sm font-bold">{t("bk.noSlots.title")}</p>
              <p className="text-sm text-muted-foreground">{t("bk.noSlots.body")}</p>
              <button
                type="button"
                onClick={() => goTo("day")}
                className="mt-1 rounded-full border border-border px-4 py-2 text-sm font-bold hover:bg-accent"
              >
                {t("bk.pickOtherDay")}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {(
                [
                  [t("bk.period.morning"), slots!.filter((s) => Number(s.time.slice(0, 2)) < 13)],
                  [t("bk.period.afternoon"), slots!.filter((s) => Number(s.time.slice(0, 2)) >= 13)],
                ] as const
              ).map(([label, group]) =>
                group.length === 0 ? null : (
                  <SlotGroup
                    key={label}
                    label={label}
                    times={group.map((s) => s.time)}
                    selected={time}
                    onSelect={(v) => {
                      setTime(v);
                      goNext();
                    }}
                  />
                ),
              )}
            </div>
          )}
        </Section>
      )}

      {currentStep === "account" && (
        <Section
          step={stepNumber}
          total={stepKeys.length}
          title={t("bk.step.yourData")}
        >
          {(
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label htmlFor="n" className="text-xs font-bold">
                  {t("bk.field.name")}
                </Label>
                <Input
                  id="n"
                  className="h-11"
                  autoComplete="name"
                  aria-invalid={!!fieldErrors.name}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((f) => ({ ...f, name: undefined }));
                  }}
                  maxLength={80}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="em" className="text-xs font-bold">
                  Email
                </Label>
                <Input
                  id="em"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-11"
                  aria-invalid={!!fieldErrors.email}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((f) => ({ ...f, email: undefined }));
                  }}
                  maxLength={160}
                  placeholder="nome@email.com"
                />
                {fieldErrors.email ? (
                  <FieldError message={fieldErrors.email} />
                ) : (
                  <p className="text-xs text-muted-foreground">{t("bk.field.emailHint")}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="p" className="text-xs font-bold">
                  {t("bk.field.phone")}
                </Label>
                <Input
                  id="p"
                  className="h-11"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={!!fieldErrors.phone}
                  value={phone}
                  onChange={(e) => {
                    setPhone(maskPhonePt(e.target.value));
                    setFieldErrors((f) => ({ ...f, phone: undefined }));
                  }}
                  placeholder="912 345 678"
                />
                <FieldError message={fieldErrors.phone} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="obs" className="text-xs font-bold">
                  {t("bk.field.notesOptional")}
                </Label>
                <Textarea
                  id="obs"
                  className="min-h-16"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
          )}
        </Section>
      )}
      </div>

      {currentStep === "account" && service && time && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-2xl flex-col gap-2.5">
            <div className="min-w-0 text-sm">
              <p className="truncate font-bold">
                {service.name} · {time}
              </p>
              <p className="truncate text-muted-foreground">
                {formatDateLong(`${date}T12:00:00Z`, business.timezone)}
              </p>
            </div>
            {submitError && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {submitError}
              </p>
            )}
            <Button onClick={submit} disabled={busy} size="lg" className="w-full">
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {busy ? t("bk.booking") : t("bk.confirmBooking")}
            </Button>
          </div>
        </div>
      )}



      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("bk.freeCancellation")}{business.cancellation_hours}{t("bk.freeCancellationAfter")}
      </p>
      <div className="mt-2 text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("bk.createMyPage")}
        </Link>
      </div>
    </main>
  );
}

function Section({
  step,
  total,
  title,
  subtitle,
  children,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section key={step} className="animate-enter mb-8">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {title}
        {total ? (
          <span className="ml-auto text-[11px] font-bold tabular-nums">
            {step}/{total}
          </span>
        ) : null}
      </h2>
      {subtitle && <p className="mb-3 text-xs font-medium text-muted-foreground">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  );
}


function SummaryChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="max-w-full truncate rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-accent"
    >
      {children}
    </button>
  );
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs font-semibold text-destructive">
      {message}
    </p>
  );
}

function ChoiceChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border border-border px-4 py-2 text-sm font-bold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function SlotGroup({
  label,
  times,
  selected,
  onSelect,
}: {
  label: string;
  times: string[];
  selected: string | null;
  onSelect: (t: string) => void;
}) {
  // Always open: collapsing the periods only added a tap before reaching a time.
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="animate-stagger mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {times.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onSelect(t)}
            className={cn(
              "rounded-xl border py-3 text-sm font-bold tabular-nums transition-colors",
              selected === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-accent",
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
