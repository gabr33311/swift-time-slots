import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search["mode"] === "register" ? ("register" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Schedivo" },
      {
        name: "description",
        content: "Entra na tua conta Schedivo para gerir marcações, clientes e a tua página pública.",
      },
      { property: "og:title", content: "Entrar — Schedivo" },
      { property: "og:description", content: "Gere as tuas marcações num só lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const passwordSchema = z
  .string()
  .min(8, { message: "A palavra-passe precisa de pelo menos 8 caracteres." })
  .max(72)
  .regex(/[A-Z]/, { message: "A palavra-passe precisa de uma letra maiúscula." })
  .regex(/[a-z]/, { message: "A palavra-passe precisa de uma letra minúscula." })
  .regex(/[0-9]/, { message: "A palavra-passe precisa de um número." })
  .regex(/[^A-Za-z0-9]/, { message: "A palavra-passe precisa de um símbolo (ex.: !?@#)." });

const schema = z.object({
  email: z.string().trim().email({ message: "Introduz um email válido." }).max(255),
  password: passwordSchema,
  name: z.string().trim().max(80).optional(),
});

const PASSWORD_RULES = [
  { label: "Pelo menos 8 caracteres", test: (v: string) => v.length >= 8 },
  { label: "Uma letra maiúscula", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Uma letra minúscula", test: (v: string) => /[a-z]/.test(v) },
  { label: "Um número", test: (v: string) => /[0-9]/.test(v) },
  { label: "Um símbolo", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

function AuthPage() {
  const navigate = useNavigate();
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<"login" | "register" | "forgot">(initialMode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  async function signInWithGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível entrar com o Google.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch {
      toast.error("Não foi possível entrar com o Google.");
    } finally {
      setBusy(false);
    }
  }


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const parsed = z.string().email().safeParse(email.trim());
        if (!parsed.success) {
          toast.error("Introduz um email válido.");
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Enviámos-te um email para recuperar a palavra-passe.");
        setMode("login");
        return;
      }

      const parsed = schema.safeParse({ email, password, name });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Verifica os dados.");
        return;
      }

      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmSent(parsed.data.email);
          toast.success("Conta criada. Confirma o email para continuar.");
          return;
        }
        toast.success("Conta criada. Vamos configurar o teu negócio.");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Invalid login credentials")) {
        toast.error("Email ou palavra-passe incorrectos.");
      } else if (message.includes("already registered") || message.includes("User already")) {
        toast.error("Já existe uma conta com este email. Entra em vez de criar conta.");
      } else if (message.includes("Email not confirmed")) {
        setConfirmSent(email.trim());
        toast.error("Ainda não confirmaste o email. Verifica a tua caixa de entrada.");
      } else if (message.toLowerCase().includes("weak password")) {
        toast.error("Palavra-passe demasiado fraca. Escolhe outra.");
      } else if (message.includes("rate limit") || message.includes("after")) {
        toast.error("Demasiadas tentativas. Espera alguns segundos.");
      } else {
        toast.error(message || "Não foi possível concluir. Tenta novamente.");
      }
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="mb-8 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarCheck className="size-4" />
        </span>
        Schedivo
      </Link>

      <div className="surface w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold">
          {mode === "login" && "Entrar"}
          {mode === "register" && "Criar conta"}
          {mode === "forgot" && "Recuperar palavra-passe"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "register"
            ? "Cria a tua página de marcações em poucos minutos."
            : "Acede ao painel do teu negócio."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O teu nome"
                maxLength={80}
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@exemplo.pt"
              autoComplete="email"
              required
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {mode === "login" && "Entrar"}
            {mode === "register" && "Criar conta"}
            {mode === "forgot" && "Enviar email"}
          </Button>
        </form>

        {mode !== "forgot" && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={signInWithGoogle}
            >
              <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"
                />
                <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
                <path
                  fill="#EA4335"
                  d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
                />
              </svg>
              Continuar com Google
            </Button>
          </>
        )}



        <div className="mt-5 space-y-2 text-center text-sm">
          {mode === "login" && (
            <>
              <button
                className="text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode("forgot")}
              >
                Esqueci-me da palavra-passe
              </button>
              <p className="text-muted-foreground">
                Ainda não tens conta?{" "}
                <button className="font-medium text-primary" onClick={() => setMode("register")}>
                  Criar conta
                </button>
              </p>
            </>
          )}
          {mode !== "login" && (
            <button className="font-medium text-primary" onClick={() => setMode("login")}>
              Voltar a entrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
