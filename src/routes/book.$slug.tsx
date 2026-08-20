import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { getPublicBusiness, getAvailableSlots, createPublicBooking } from "@/lib/booking.functions";
import { trackPageView } from "@/lib/analytics.functions";
import { AddToCalendar } from "@/components/add-to-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatPrice, formatDateLong, initials } from "@/lib/format";
import { addDays, todayIn, zonedToUtc, timeToMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarDays, Check, Clock, Instagram, MapPin, Phone } from "lucide-react";

export const Route = createFileRoute("/book/$slug")({
  loader: async ({ params }) => {
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
  errorComponent: () => (
    <CenteredMessage
      title="Não foi possível abrir esta página"
      body="Tenta novamente daqui a pouco."
    />
  ),
  notFoundComponent: () => (
    <CenteredMessage
      title="Página não encontrada"
      body="Este negócio não existe ou ainda não publicou a página de marcações."
    />
  ),
  component: BookPage,
});

function CenteredMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary underline">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}

const formSchema = z.object({
  name: z.string().trim().min(2, "Indica o teu nome.").max(80),
  phone: z
    .string()
    .trim()
    .min(6, "Indica um telemóvel válido.")
    .max(24)
    .regex(/^[0-9+\s()-]+$/, "Indica um telemóvel válido."),
  email: z.string().trim().email("Email inválido.").max(160).or(z.literal("")),
  notes: z.string().trim().max(500),
});

function BookPage() {
  const { business, services, staff } = Route.useLoaderData();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIn(business.timezone));
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ token: string; status: string } | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const eligibleStaff = useMemo(
    () => (serviceId ? staff.filter((s) => s.service_ids.includes(serviceId)) : staff),
    [staff, serviceId],
  );

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(todayIn(business.timezone), i)),
    [business.timezone],
  );

  const { data: slots, isFetching } = useQuery({
    queryKey: ["slots", business.id, serviceId, staffId, date],
    enabled: !!serviceId,
    queryFn: async () =>
      await getAvailableSlots({
        data: { businessId: business.id, serviceId: serviceId!, staffId, date },
      }),
  });

  // One view per browser session (refreshes don't count again).
  useEffect(() => {
    const key = `schedivo-view-${business.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    let sid = localStorage.getItem("schedivo-sid");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("schedivo-sid", sid);
    }
    void trackPageView({ data: { businessId: business.id, sessionId: sid } }).catch(() => {});
  }, [business.id]);

  async function submit() {
    const parsed = formSchema.safeParse({ name, phone, email, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifica os dados.");
      return;
    }
    if (!serviceId || !time) return;
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
        toast.error(res.message);
        if (res.code === "slot_taken") setTime(null);
        return;
      }
      setDone({ token: res.token, status: res.status });
    } catch {
      toast.error("Não foi possível concluir a marcação. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <div className="surface p-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="size-7" />
          </div>
          <h1 className="text-xl font-bold">
            {done.status === "pending" ? "Pedido enviado" : "Marcação confirmada"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {formatDateLong(`${date}T12:00:00Z`, business.timezone)} às {time} · {service?.name}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            {done.status === "pending"
              ? "Vais receber a confirmação do negócio em breve."
              : "Guarda o link abaixo para consultar, reagendar ou cancelar."}
          </p>
          <Link
            to="/booking/$token"
            params={{ token: done.token }}
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Ver a minha marcação
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="animate-enter mx-auto max-w-2xl px-5 pb-24 pt-8">
      <header className="mb-8">
        <div className="flex items-center gap-4">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white"
            style={{ backgroundColor: business.brand_color }}
          >
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={`Logótipo de ${business.name}`}
                className="size-full rounded-2xl object-cover"
              />
            ) : (
              initials(business.name)
            )}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{business.name}</h1>
            {business.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {business.description}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {business.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" /> {business.address}
              {business.city ? `, ${business.city}` : ""}
            </span>
          )}
          {business.phone && (
            <a href={`tel:${business.phone}`} className="inline-flex items-center gap-1.5">
              <Phone className="size-4" /> {business.phone}
            </a>
          )}
        </div>
      </header>

      <Section step={1} title="Escolhe o serviço">
        <div className="grid gap-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setServiceId(s.id);
                setStaffId(null);
                setTime(null);
              }}
              className={cn(
                "surface surface-hover flex items-center justify-between gap-4 p-4 text-left transition-all",
                serviceId === s.id && "ring-2 ring-primary",
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

      {service && eligibleStaff.length > 1 && (
        <Section step={2} title="Com quem?">
          <div className="flex flex-wrap gap-2">
            <ChoiceChip active={staffId === null} onClick={() => setStaffId(null)}>
              Qualquer profissional
            </ChoiceChip>
            {eligibleStaff.map((p) => (
              <ChoiceChip
                key={p.id}
                active={staffId === p.id}
                onClick={() => {
                  setStaffId(p.id);
                  setTime(null);
                }}
              >
                {p.name}
              </ChoiceChip>
            ))}
          </div>
        </Section>
      )}

      {service && (
        <Section step={eligibleStaff.length > 1 ? 3 : 2} title="Escolhe o dia e a hora">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {days.map((d) => {
              const dt = new Date(`${d}T12:00:00Z`);
              return (
                <button
                  key={d}
                  onClick={() => {
                    setDate(d);
                    setTime(null);
                  }}
                  className={cn(
                    "flex w-16 shrink-0 flex-col items-center rounded-xl border border-border px-2 py-2.5 text-sm transition-colors",
                    date === d && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  <span className="text-xs uppercase">
                    {new Intl.DateTimeFormat("pt-PT", {
                      weekday: "short",
                      timeZone: business.timezone,
                    }).format(dt)}
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {new Intl.DateTimeFormat("pt-PT", {
                      day: "2-digit",
                      timeZone: business.timezone,
                    }).format(dt)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {isFetching ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-lg" />
                ))}
              </div>
            ) : (slots?.length ?? 0) === 0 ? (
              <div className="surface flex flex-col items-center gap-2 p-8 text-center">
                <CalendarDays className="size-5 text-muted-foreground" />
                <p className="text-sm font-bold">Sem horários neste dia.</p>
                <p className="text-sm text-muted-foreground">Experimenta outro dia.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots!.map((s) => (
                  <button
                    key={s.time}
                    onClick={() => setTime(s.time)}
                    className={cn(
                      "rounded-lg border border-border py-2.5 text-sm font-bold tabular-nums transition-colors",
                      time === s.time
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent",
                    )}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}

      {service && time && (
        <Section step={eligibleStaff.length > 1 ? 4 : 3} title="Os teus dados">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="n">Nome</Label>
              <Input id="n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p">Telemóvel</Label>
              <Input
                id="p"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={24}
                placeholder="912 345 678"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e">Email (opcional)</Label>
              <Input
                id="e"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs">Notas (opcional)</Label>
              <Textarea
                id="obs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>
        </Section>
      )}

      {service && time && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-4">
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">
                {service.name} · {time}
              </p>
              <p className="truncate text-muted-foreground">
                {formatDateLong(`${date}T12:00:00Z`, business.timezone)}
              </p>
            </div>
            <Button onClick={submit} disabled={busy} size="lg">
              {busy ? "A marcar…" : "Confirmar marcação"}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Cancelamento gratuito até {business.cancellation_hours}h antes.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Criar a minha página de marcações
      </Link>
    </main>
  );
}

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-enter mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
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
