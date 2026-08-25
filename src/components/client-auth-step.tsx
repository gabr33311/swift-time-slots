import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { maskPhonePt, isValidPhonePt } from "@/lib/phone";

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Indica o teu nome próprio.").max(80),
  phone: z.string().trim(),
  email: z.string().trim().email("Email inválido.").max(160),
});

/**
 * Client account step: name + phone + email, confirmed with a 6-digit code
 * sent by email. Creates the account when it does not exist yet.
 */
export function ClientAuthStep({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const parsed = detailsSchema.safeParse({ name, phone, email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Verifica os dados.");
      return;
    }
    if (!isValidPhonePt(phone)) {
      toast.error("Indica um telemóvel com 9 dígitos.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { shouldCreateUser: true, data: { full_name: parsed.data.name } },
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível enviar o código. Verifica o email.");
      return;
    }
    toast.success("Enviámos um código de 6 dígitos para o teu email.");
    setStage("code");
  }

  async function verify() {
    if (code.replace(/\D/g, "").length !== 6) {
      toast.error("Introduz o código de 6 dígitos.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ""),
      type: "email",
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error("Código inválido ou expirado.");
      return;
    }
    await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: phone.trim() })
      .eq("id", data.user.id);
    setBusy(false);
    toast.success("Email confirmado. Bem-vindo!");
    onDone();
  }

  if (stage === "code") {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <MailCheck className="size-4 text-primary" /> Confirma o teu email
        </div>
        <p className="text-sm text-muted-foreground">
          Enviámos um código para <span className="font-bold text-foreground">{email}</span>.
        </p>
        <Input
          className="mt-3 h-10 text-center text-lg font-bold tracking-[0.4em]"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          aria-label="Código de confirmação"
        />
        <Button className="mt-3 w-full" onClick={verify} disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Confirmar email
        </Button>
        <button
          onClick={() => setStage("details")}
          className="mt-2 w-full text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          Alterar dados
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="size-4 text-primary" /> Criar conta / entrar
      </div>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor="cname" className="text-xs font-bold">
            Nome próprio
          </Label>
          <Input
            id="cname"
            className="h-9"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cphone" className="text-xs font-bold">
            Telemóvel
          </Label>
          <Input
            id="cphone"
            className="h-9"
            inputMode="tel"
            value={phone}
            placeholder="912 345 678"
            onChange={(e) => setPhone(maskPhonePt(e.target.value))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cemail" className="text-xs font-bold">
            Email
          </Label>
          <Input
            id="cemail"
            className="h-9"
            type="email"
            value={email}
            maxLength={160}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={sendCode} disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />} Enviar código por email
      </Button>
    </div>
  );
}
