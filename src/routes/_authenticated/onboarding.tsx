import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_TYPES, businessType } from "@/lib/business-types";
import { slugify } from "@/lib/format";
import { WEEKDAYS_PT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, Loader2, ArrowRight, ArrowLeft, Copy, ExternalLink, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Configurar o teu negócio — Marca" },
      { name: "description", content: "Configura o teu negócio e cria a tua página de marcações." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

type DraftService = { name: string; duration: number; price: number };
type DraftStaff = { name: string; specialty: string };
type DayHours = {
  open: boolean;
  start: string;
  end: string;
  lunch: boolean;
  lunchStart: string;
  lunchEnd: string;
};

const day = (open: boolean, start: string, end: string, lunch = open): DayHours => ({
  open,
  start,
  end,
  lunch,
  lunchStart: "13:00",
  lunchEnd: "14:00",
});

const DEFAULT_HOURS: DayHours[] = [
  day(false, "09:00", "18:00", false),
  day(true, "09:00", "18:00"),
  day(true, "09:00", "18:00"),
  day(true, "09:00", "18:00"),
  day(true, "09:00", "18:00"),
  day(true, "09:00", "18:00"),
  day(false, "09:00", "13:00", false),
];

function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState("barbershop");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [services, setServices] = useState<DraftService[]>([]);
  const [staff, setStaff] = useState<DraftStaff[]>([{ name: "", specialty: "" }]);
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    setServices(
      businessType(type).sampleServices.map((s) => ({
        name: s.name,
        duration: s.duration,
        price: s.price / 100,
      })),
    );
  }, [type]);

  useEffect(() => {
    // Send users who already have a business straight to the dashboard.
    supabase
      .from("business_members")
      .select("business_id")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) navigate({ to: "/dashboard" });
      });
  }, [navigate]);

  const bookingUrl =
    typeof window !== "undefined" && createdSlug
      ? `${window.location.origin}/book/${createdSlug}`
      : "";

  async function finish() {
    const parsed = z
      .object({
        name: z.string().trim().min(2, "Indica o nome do negócio.").max(80),
        slug: z
          .string()
          .trim()
          .min(3, "O link precisa de pelo menos 3 caracteres.")
          .max(48)
          .regex(/^[a-z0-9-]+$/, "O link só pode ter letras minúsculas, números e hífens."),
        description: z.string().trim().min(10, "Escreve uma descrição curta do negócio.").max(280),
        city: z.string().trim().min(2, "Indica a cidade.").max(60),
        address: z.string().trim().min(4, "Indica a morada.").max(140),
        phone: z.string().trim().max(24).optional(),
      })
      .safeParse({ name, slug, description, city, address, phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifica os dados.");
      setStep(1);
      return;
    }
    const validServices = services.filter((s) => s.name.trim().length > 0);
    if (validServices.length === 0) {
      toast.error("Adiciona pelo menos um serviço.");
      setStep(2);
      return;
    }
    const validStaff = staff.filter((s) => s.name.trim().length > 0);
    if (validStaff.length === 0) {
      toast.error("Adiciona pelo menos um profissional.");
      setStep(3);
      return;
    }
    if (!hours.some((h) => h.open)) {
      toast.error("Escolhe pelo menos um dia de trabalho.");
      setStep(4);
      return;
    }

    setBusy(true);
    try {
      const { data: business, error } = await supabase
        .from("businesses")
        .insert({
          name: name.trim(),
          slug: parsed.data.slug,
          business_type: type,
          description: description.trim() || null,
          city: city.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          instagram: instagram.trim().replace(/^@/, "") || null,
          created_by: user!.id,
          onboarding_completed: true,
        })
        .select("id, slug")
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Esse link já está a ser usado. Escolhe outro.");
          setStep(1);
          return;
        }
        throw error;
      }

      await supabase
        .from("business_members")
        .insert({ business_id: business.id, user_id: user!.id, role: "owner" });

      const { data: insertedServices } = await supabase
        .from("services")
        .insert(
          validServices.map((s, i) => ({
            business_id: business.id,
            name: s.name.trim(),
            duration_minutes: Math.max(5, Math.round(s.duration)),
            price_cents: Math.max(0, Math.round(s.price * 100)),
            sort_order: i,
          })),
        )
        .select("id");

      const { data: insertedStaff } = await supabase
        .from("staff")
        .insert(
          validStaff.map((s, i) => ({
            business_id: business.id,
            name: s.name.trim(),
            specialty: s.specialty.trim() || null,
            user_id: i === 0 ? user!.id : null,
            sort_order: i,
          })),
        )
        .select("id");

      if (insertedServices && insertedStaff) {
        await supabase.from("staff_services").insert(
          insertedStaff.flatMap((st) =>
            insertedServices.map((sv) => ({
              staff_id: st.id,
              service_id: sv.id,
              business_id: business.id,
            })),
          ),
        );

        await supabase.from("working_hours").insert(
          insertedStaff.flatMap((st) =>
            hours
              .map((h, weekday) => ({ h, weekday }))
              .filter(({ h }) => h.open)
              .map(({ h, weekday }) => ({
                business_id: business.id,
                staff_id: st.id,
                weekday,
                start_time: h.start,
                end_time: h.end,
              })),
          ),
        );
      }

      await supabase.from("subscriptions").insert({ business_id: business.id, plan: "free" });

      window.localStorage.setItem("active_business", business.id);
      setCreatedSlug(business.slug);
      setStep(6);
    } catch {
      toast.error("Não foi possível criar o negócio. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (step === 6 && createdSlug) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
        <div className="surface p-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-success/15 text-success">
            <Check className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold">Está tudo pronto.</h1>
          <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-muted-foreground">
            {["Negócio criado", "Serviços adicionados", "Horário configurado", "Página criada"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-success" /> {item}
                </li>
              ),
            )}
          </ul>
          <p className="mt-6 text-sm">Partilha o teu link para começar a receber marcações.</p>
          <p className="mt-2 break-all rounded-lg bg-muted px-3 py-2 text-sm font-medium">
            {bookingUrl}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                toast.success("Link copiado.");
              }}
            >
              <Copy className="mr-2 size-4" /> Copiar link
            </Button>
            <Button variant="outline" asChild>
              <a href={`/book/${createdSlug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" /> Ver página
              </a>
            </Button>
            <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
              Ir para o painel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">Passo {step} de 5</p>
        <div className="mt-2 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="surface space-y-5 p-6">
          <div>
            <h1 className="text-xl font-semibold">O teu negócio</h1>
            <p className="mt-1 text-sm text-muted-foreground">Só o essencial para começar.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bname">Nome do negócio</Label>
            <Input
              id="bname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barbearia do Gabriel"
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo de negócio</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    type === t.value
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <span className="mr-1.5">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">O teu link</Label>
            <div className="flex items-center gap-1 rounded-lg border border-input bg-muted/40 px-3">
              <span className="text-sm text-muted-foreground">/book/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                placeholder="barbearia-do-gabriel"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Descrição curta</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cortes clássicos e modernos no centro do Porto."
              maxLength={280}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telemóvel</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="912 345 678"
                maxLength={24}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr">Morada</Label>
              <Input
                id="addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={140}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig">Instagram</Label>
              <Input
                id="ig"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@onegocio"
                maxLength={60}
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="surface space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">Os teus serviços</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Já sugerimos alguns. Ajusta preços e durações.
            </p>
          </div>
          {services.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={s.name}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  maxLength={60}
                />
              </div>
              <div className="w-20 space-y-1.5">
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={s.duration}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, j) =>
                        i === j ? { ...x, duration: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label className="text-xs">Preço €</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={s.price}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x, j) => (i === j ? { ...x, price: Number(e.target.value) } : x)),
                    )
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover serviço"
                onClick={() => setServices((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => setServices((p) => [...p, { name: "", duration: 30, price: 20 }])}
          >
            Adicionar serviço
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="surface space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">Quem atende?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Se trabalhas sozinho, adiciona só o teu nome.
            </p>
          </div>
          {staff.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={s.name}
                  onChange={(e) =>
                    setStaff((prev) =>
                      prev.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)),
                    )
                  }
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Especialidade</Label>
                <Input
                  value={s.specialty}
                  onChange={(e) =>
                    setStaff((prev) =>
                      prev.map((x, j) => (i === j ? { ...x, specialty: e.target.value } : x)),
                    )
                  }
                  maxLength={60}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover profissional"
                onClick={() => setStaff((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={() => setStaff((p) => [...p, { name: "", specialty: "" }])}
          >
            Adicionar profissional
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="surface space-y-3 p-6">
          <div>
            <h1 className="text-xl font-semibold">Define quando estás disponível.</h1>
            <p className="mt-1 text-sm text-muted-foreground">Podes ajustar depois.</p>
          </div>
          {hours.map((h, i) => (
            <div key={i} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setHours((prev) => prev.map((x, j) => (i === j ? { ...x, open: !x.open } : x)))
                }
                className={cn(
                  "w-28 rounded-lg border px-3 py-2 text-left text-sm font-medium",
                  h.open ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground",
                )}
              >
                {WEEKDAYS_PT[i]}
              </button>
              {h.open ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={h.start}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((x, j) => (i === j ? { ...x, start: e.target.value } : x)),
                      )
                    }
                    className="w-32"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={h.end}
                    onChange={(e) =>
                      setHours((prev) =>
                        prev.map((x, j) => (i === j ? { ...x, end: e.target.value } : x)),
                      )
                    }
                    className="w-32"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Fechado</span>
              )}
            </div>
          ))}
        </div>
      )}

      {step === 5 && (
        <div className="surface space-y-4 p-6">
          <h1 className="text-xl font-semibold">Confirma e cria a tua página</h1>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Negócio</dt>
              <dd className="font-medium">{name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Link</dt>
              <dd className="font-medium">/book/{slug || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Serviços</dt>
              <dd className="font-medium">{services.filter((s) => s.name).length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Profissionais</dt>
              <dd className="font-medium">{staff.filter((s) => s.name).length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Dias abertos</dt>
              <dd className="font-medium">{hours.filter((h) => h.open).length}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          <ArrowLeft className="mr-2 size-4" /> Voltar
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep((s) => s + 1)}>
            Continuar <ArrowRight className="ml-2 size-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Criar a minha página
          </Button>
        )}
      </div>
    </div>
  );
}
