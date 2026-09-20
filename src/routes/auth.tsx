import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CalendarCheck, Loader2, MailCheck, Check, X } from "lucide-react";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search["mode"] === "register" ? ("register" as const) : undefined,
    // Same-origin path to return to after signing in (e.g. a public booking page).
    next:
      typeof search["next"] === "string" && (search["next"] as string).startsWith("/")
        ? (search["next"] as string)
        : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Entrar — SYCRAS" },
      {
        name: "description",
        content: "Entra na tua conta SYCRAS para gerir marcações, clientes e a tua página pública.",
      },
      { property: "og:title", content: "Entrar — SYCRAS" },
      { property: "og:description", content: "Gere as tuas marcações num só lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const passwordSchema = z
  .string()
  .min(8, { message: "onb.auth.err.password.min" })
  .max(72)
  .regex(/[A-Z]/, { message: "onb.auth.err.password.upper" })
  .regex(/[a-z]/, { message: "onb.auth.err.password.lower" })
  .regex(/[0-9]/, { message: "onb.auth.err.password.number" })
  .regex(/[^A-Za-z0-9]/, { message: "onb.auth.err.password.symbol" });

const schema = z.object({
  email: z.string().trim().email({ message: "onb.auth.err.email" }).max(255),
  password: passwordSchema,
  name: z.string().trim().max(80).optional(),
});

const PASSWORD_RULES = [
  { label: "onb.auth.rule.min", test: (v: string) => v.length >= 8 },
  { label: "onb.auth.rule.upper", test: (v: string) => /[A-Z]/.test(v) },
  { label: "onb.auth.rule.lower", test: (v: string) => /[a-z]/.test(v) },
  { label: "onb.auth.rule.number", test: (v: string) => /[0-9]/.test(v) },
  { label: "onb.auth.rule.symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

function AuthPage() {
  const { t } = usePrefs();
  const navigate = useNavigate();
  const { mode: initialMode, next } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  // Returns the signed-in user to where they came from, or the pro dashboard.
  function goAfterAuth(fallback: "/dashboard" | "/onboarding" = "/dashboard") {
    if (next) {
      navigate({ href: next });
      return;
    }
    navigate({ to: fallback });
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) goAfterAuth();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, next]);





  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const parsed = z.string().email().safeParse(email.trim());
        if (!parsed.success) {
          toast.error(t("onb.auth.err.email"));
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("onb.auth.success.resetEmail"));
        setMode("login");
        return;
      }

      const parsed = schema.safeParse({ email, password, name });
      if (!parsed.success) {
        toast.error(t(parsed.error.issues[0]?.message ?? "onb.auth.err.checkData"));
        return;
      }

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}${next ?? "/onboarding"}`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(parsed.data.email);
          toast.success(t("onb.auth.success.accountCreated"));
          return;
        }
        toast.success(t("onb.auth.success.accountCreatedGo"));
        goAfterAuth("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        goAfterAuth();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Invalid login credentials")) {
        toast.error(t("onb.auth.err.invalidLogin"));
      } else if (message.includes("already registered") || message.includes("User already")) {
        toast.error(t("onb.auth.err.alreadyRegistered"));
      } else if (message.includes("Email not confirmed")) {
        setConfirmSent(email.trim());
        toast.error(t("onb.auth.err.emailNotConfirmed"));
      } else if (message.toLowerCase().includes("weak password")) {
        toast.error(t("onb.auth.err.weakPassword"));
      } else if (message.includes("rate limit") || message.includes("after")) {
        toast.error(t("onb.auth.err.rateLimit"));
      } else {
        toast.error(message || t("onb.auth.err.generic"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmSent) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmSent,
        options: { emailRedirectTo: `${window.location.origin}${next ?? "/onboarding"}` },
      });
      if (error) throw error;
      toast.success(t("onb.auth.success.resent"));
    } catch {
      toast.error(t("onb.auth.err.resend"));
    } finally {
      setBusy(false);
    }
  }

  if (confirmSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="surface animate-enter w-full max-w-sm p-7 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
            <MailCheck className="size-7" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-semibold">{t("onb.auth.confirmTitle")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("onb.auth.confirmBody1")} <span className="font-medium">{confirmSent}</span>.{" "}
            {t("onb.auth.confirmBody2")}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={resendConfirmation} disabled={busy} variant="outline">
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("onb.auth.resend")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmSent(null);
                setMode("login");
              }}
            >
              {t("onb.auth.backToLogin")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarCheck className="size-4" />
        </span>
        SYCRAS
      </Link>

      <div className="surface animate-enter w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">
          {mode === "login" && t("onb.auth.title.login")}
          {mode === "register" && t("onb.auth.title.register")}
          {mode === "forgot" && t("onb.auth.title.forgot")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "register"
            ? t("onb.auth.subtitle.register")
            : t("onb.auth.subtitle.other")}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("onb.auth.name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("onb.auth.name.placeholder")}
                maxLength={80}
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("onb.auth.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("onb.auth.email.placeholder")}
              autoComplete="email"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("onb.auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("onb.auth.password.placeholder")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
              {mode === "register" && (
                <ul className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((r) => {
                    const ok = r.test(password);
                    return (
                      <li
                        key={r.label}
                        className={cn(
                          "flex items-center gap-1.5 text-xs transition-colors",
                          ok ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {ok ? (
                          <Check className="size-3.5" strokeWidth={3} />
                        ) : (
                          <X className="size-3.5" strokeWidth={3} />
                        )}
                        {t(r.label)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {mode === "login" && t("onb.auth.submit.login")}
            {mode === "register" && t("onb.auth.submit.register")}
            {mode === "forgot" && t("onb.auth.submit.forgot")}
          </Button>
        </form>




        <div className="mt-5 space-y-2 text-center text-sm">
          {mode === "login" && (
            <>
              <button
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode("forgot")}
              >
                {t("onb.auth.forgotPassword")}
              </button>
              <p className="text-muted-foreground">
                {t("onb.auth.noAccount")}{" "}
                <button className="font-medium text-primary" onClick={() => setMode("register")}>
                  {t("onb.auth.createAccount")}
                </button>
              </p>
            </>
          )}
          {mode !== "login" && (
            <button className="font-medium text-primary" onClick={() => setMode("login")}>
              {t("onb.auth.backToLogin2")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
