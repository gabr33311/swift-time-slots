import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { usePrefs } from "@/lib/prefs";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUSINESS_TYPES, businessType } from "@/lib/business-types";
import { slugify } from "@/lib/format";
import { WEEKDAYS_PT } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Check,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Copy,
  ExternalLink,
  Trash2,
  CircleCheck,
  CircleX,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { checkSlugAvailable } from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Configurar o teu negócio — Schedivo" },
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
  const { t } = usePrefs();
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
        name: t(s.name),
        duration: s.duration,
        price: s.price / 100,
      })),
    );
  }, [type, t]);

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

  const [slugCheck, setSlugCheck] = useState<
    { state: "idle" | "checking" | "free" | "taken" | "invalid"; slug: string }
  >({ state: "idle", slug: "" });

  useEffect(() => {
    const clean = slug.trim().toLowerCase();
    if (clean.length < 3) {
      setSlugCheck({ state: "invalid", slug: clean });
      return;
    }
    setSlugCheck({ state: "checking", slug: clean });
    const id = setTimeout(async () => {
      try {
        const res = await checkSlugAvailable({ data: { slug: clean } });
        setSlugCheck({
          state: res.invalid ? "invalid" : res.available ? "free" : "taken",
          slug: clean,
        });
      } catch {
        setSlugCheck({ state: "idle", slug: clean });
      }
    }, 450);
    return () => clearTimeout(id);
  }, [slug]);

  const step1Valid =
    name.trim().length >= 2 &&
    description.trim().length >= 10 &&
    city.trim().length >= 2 &&
    address.trim().length >= 4 &&
    slugCheck.state === "free";
  const step2Valid = services.some((s) => s.name.trim().length > 0 && s.duration >= 5);
  const step3Valid = staff.some((s) => s.name.trim().length > 0);
  const step4Valid =
    hours.some((h) => h.open) &&
    hours.every(
      (h) =>
        !h.open ||
        (h.start < h.end &&
          (!h.lunch || (h.start < h.lunchStart && h.lunchStart < h.lunchEnd && h.lunchEnd < h.end))),
    );
  const stepValid = [step1Valid, step2Valid, step3Valid, step4Valid, true][step - 1] ?? true;
  const stepHint = !step1Valid
    ? t("onb.hint.step1")
    : !step2Valid
      ? t("onb.hint.step2")
      : !step3Valid
        ? t("onb.hint.step3")
        : t("onb.hint.step4");

  const bookingUrl =
    typeof window !== "undefined" && createdSlug
      ? `${window.location.origin}/book/${createdSlug}`
      : "";

  async function finish() {
    const parsed = z
      .object({
        name: z.string().trim().min(2, "onb.err.name").max(80),
        slug: z
          .string()
          .trim()
          .min(3, "onb.err.slugMin")
          .max(48)
          .regex(/^[a-z0-9-]+$/, "onb.err.slugFormat"),
        description: z.string().trim().min(10, "onb.err.description").max(280),
        city: z.string().trim().min(2, "onb.err.city").max(60),
        address: z.string().trim().min(4, "onb.err.address").max(140),
        phone: z.string().trim().max(24).optional(),
      })
      .safeParse({ name, slug, description, city, address, phone });
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "onb.err.checkData"));
      setStep(1);
      return;
    }
    const validServices = services.filter((s) => s.name.trim().length > 0);
    if (validServices.length === 0) {
      toast.error(t("onb.err.addService"));
      setStep(2);
      return;
    }
    const validStaff = staff.filter((s) => s.name.trim().length > 0);
    if (validStaff.length === 0) {
      toast.error(t("onb.err.addStaff"));
      setStep(3);
      return;
    }
    if (!hours.some((h) => h.open)) {
      toast.error(t("onb.err.chooseDay"));
      setStep(4);
      return;
    }
    const badLunch = hours.some(
      (h) =>
        h.open &&
        h.lunch &&
        !(h.start < h.lunchStart && h.lunchStart < h.lunchEnd && h.lunchEnd < h.end),
    );
    if (badLunch) {
      toast.error(t("onb.err.lunchRange"));
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
          toast.error(t("onb.err.slugTaken"));
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
              .flatMap(({ h, weekday }) =>
                (h.lunch
                  ? [
                      { start_time: h.start, end_time: h.lunchStart },
                      { start_time: h.lunchEnd, end_time: h.end },
                    ]
                  : [{ start_time: h.start, end_time: h.end }]
                ).map((range) => ({
                  business_id: business.id,
                  staff_id: st.id,
                  weekday,
                  ...range,
                })),
              ),
          ),
        );
      }

      await supabase.from("subscriptions").insert({ business_id: business.id, plan: "free" });

      window.localStorage.setItem("active_business", business.id);
      setCreatedSlug(business.slug);
      setStep(6);
    } catch {
      toast.error(t("onb.err.createFailed"));
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
          <h1 className="text-2xl font-semibold">{t("onb.success.title")}</h1>
          <ul className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-muted-foreground">
            {[t("onb.success.item1"), t("onb.success.item2"), t("onb.success.item3"), t("onb.success.item4")].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-success" /> {item}
                </li>
              ),
            )}
          </ul>
          <p className="mt-6 text-sm">{t("onb.success.share")}</p>
          <p className="mt-2 break-all rounded-lg bg-muted px-3 py-2 text-sm font-medium">
            {bookingUrl}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl);
                toast.success(t("onb.success.linkCopied"));
              }}
            >
              <Copy className="mr-2 size-4" /> Copiar link
            </Button>
            <Button variant="outline" asChild>
              <a href={`/book/${createdSlug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 size-4" /> Ver página
              </a>
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              {t("onb.success.goDashboard")}
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
        <div key={step} className="surface animate-slide-in space-y-5 p-6">
          <div>
            <h1 className="text-xl font-semibold">{t("onb.s1.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("onb.s1.subtitle")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bname" className="font-semibold">
              {t("onb.s1.name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("onb.s1.name.placeholder")}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold">
              {t("onb.s1.type")} <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => setType(bt.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    type === bt.value
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <bt.icon className="mr-1.5 inline size-4 align-[-3px]" strokeWidth={2.5} />
                  {t(bt.label)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug" className="font-semibold">
              {t("onb.s1.slug")} <span className="text-destructive">*</span>
            </Label>
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
                placeholder={t("onb.s1.slug.placeholder")}
              />
              {slugCheck.state === "checking" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {slugCheck.state === "free" && <CircleCheck className="size-4 text-success" />}
              {(slugCheck.state === "taken" || slugCheck.state === "invalid") && (
                <CircleX className="size-4 text-destructive" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {slugCheck.state === "free" && (
                <span className="text-success">{t("onb.s1.slug.free")}</span>
              )}
              {slugCheck.state === "taken" && (
                <span className="text-destructive">{t("onb.s1.slug.taken")}</span>
              )}
              {slugCheck.state === "invalid" &&
                t("onb.s1.slug.invalid")}
              {slugCheck.state === "checking" && t("onb.s1.slug.checking")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc" className="font-semibold">
              {t("onb.s1.desc")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("onb.s1.desc.placeholder")}
              maxLength={280}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city" className="font-semibold">
                {t("onb.s1.city")} <span className="text-destructive">*</span>
              </Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="font-semibold">
                Telemóvel{" "}
                <span className="font-normal text-muted-foreground">(opcional, recomendado)</span>
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("onb.s1.phone.placeholder")}
                maxLength={24}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr" className="font-semibold">
                Morada <span className="text-destructive">*</span>
              </Label>
              <Input
                id="addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={140}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig" className="font-semibold">
                Instagram <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="ig"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder={t("onb.s1.instagram.placeholder")}
                maxLength={60}
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div key={step} className="surface animate-slide-in space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">{t("onb.s2.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("onb.s2.subtitle")}
            </p>
          </div>
          {services.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("onb.s2.serviceName")}</Label>
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
              <div className="w-32 space-y-1.5">
                <Label className="text-xs font-semibold">{t("onb.s2.duration")}</Label>
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
                <Label className="text-xs font-semibold">{t("onb.s2.price")}</Label>
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
                aria-label={t("onb.s2.remove")}
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
            {t("onb.s2.add")}
          </Button>
        </div>
      )}

      {step === 3 && (
        <div key={step} className="surface animate-slide-in space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">{t("onb.s3.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("onb.s3.subtitle")}
            </p>
          </div>
          {staff.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Nome <span className="text-destructive">*</span>
                </Label>
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
                <Label className="text-xs font-semibold">
                  Especialidade <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
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
                aria-label={t("onb.s3.remove")}
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
            {t("onb.s3.add")}
          </Button>
        </div>
      )}

      {step === 4 && (
        <div key={step} className="surface animate-slide-in space-y-3 p-6">
          <div>
            <h1 className="text-xl font-semibold">{t("onb.s4.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("onb.s4.subtitle")}</p>
          </div>
          {hours.map((h, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setHours((prev) => prev.map((x, j) => (i === j ? { ...x, open: !x.open } : x)))
                  }
                  className={cn(
                    "w-28 rounded-lg border px-3 py-2 text-left text-sm font-semibold",
                    h.open
                      ? "border-primary bg-accent text-accent-foreground"
                      : "border-border text-muted-foreground",
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
                  <span className="text-sm text-muted-foreground">{t("onb.s4.closed")}</span>
                )}
              </div>

              {h.open && (
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setHours((prev) =>
                        prev.map((x, j) => (i === j ? { ...x, lunch: !x.lunch } : x)),
                      )
                    }
                    className={cn(
                      "w-28 rounded-lg border px-3 py-2 text-left text-xs font-semibold",
                      h.lunch
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {t("onb.s4.lunch")}
                  </button>
                  {h.lunch ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={h.lunchStart}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((x, j) =>
                              i === j ? { ...x, lunchStart: e.target.value } : x,
                            ),
                          )
                        }
                        className="w-32"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={h.lunchEnd}
                        onChange={(e) =>
                          setHours((prev) =>
                            prev.map((x, j) => (i === j ? { ...x, lunchEnd: e.target.value } : x)),
                          )
                        }
                        className="w-32"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">{t("onb.s4.noLunch")}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {step === 5 && (
        <div key={step} className="surface animate-slide-in space-y-4 p-6">
          <h1 className="text-xl font-semibold">{t("onb.s5.title")}</h1>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("onb.s5.business")}</dt>
              <dd className="font-medium">{name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("onb.s5.link")}</dt>
              <dd className="font-medium">/book/{slug || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("onb.s5.services")}</dt>
              <dd className="font-medium">{services.filter((s) => s.name).length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("onb.s5.staff")}</dt>
              <dd className="font-medium">{staff.filter((s) => s.name).length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("onb.s5.openDays")}</dt>
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
          <div className="flex flex-col items-end gap-1.5">
            <Button onClick={() => setStep((s) => s + 1)} disabled={!stepValid}>
              Continuar <ArrowRight className="ml-2 size-4" />
            </Button>
            {!stepValid && <p className="text-xs text-muted-foreground">{stepHint}</p>}
          </div>
        ) : (
          <Button onClick={finish} disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("onb.create")}
          </Button>
        )}
      </div>
    </div>
  );
}
