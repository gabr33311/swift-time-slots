import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Marca" },
      {
        name: "description",
        content: "Entra na tua conta Marca para gerir marcações, clientes e a tua página pública.",
      },
      { property: "og:title", content: "Entrar — Marca" },
      { property: "og:description", content: "Gere as tuas marcações num só lugar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "Introduz um email válido." }).max(255),
  password: z.string().min(8, { message: "A palavra-passe precisa de pelo menos 8 caracteres." }),
  name: z.string().trim().max(80).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

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
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
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
      } else if (message.includes("already registered")) {
        toast.error("Já existe uma conta com este email.");
      } else {
        toast.error("Não foi possível concluir. Tenta novamente.");
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
        Marca
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
