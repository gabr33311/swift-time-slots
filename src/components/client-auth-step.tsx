import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { maskPhonePt, isValidPhonePt } from "@/lib/phone";
import { usePrefs } from "@/lib/prefs";

const detailsSchema = z.object({
  name: z.string().trim().min(2, "bk.auth.err.name").max(80),
  phone: z.string().trim(),
  email: z.string().trim().email("bk.auth.err.email").max(160),
});

/**
 * Client account step: name + phone + email, confirmed with a 6-digit code
 * sent by email. Creates the account when it does not exist yet.
 */
export function ClientAuthStep({ onDone }: { onDone: () => void }) {
  const { t } = usePrefs();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [stage, setStage] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (mode === "signup") {
      const parsed = detailsSchema.safeParse({ name, phone, email });
      if (!parsed.success) {
        toast.error(t(parsed.error.issues[0]?.message ?? "bk.auth.err.check"));
        return;
      }
      if (!isValidPhonePt(phone)) {
        toast.error(t("bk.auth.err.phone"));
        return;
      }
    } else if (!z.string().email().safeParse(email.trim()).success) {
      toast.error(t("bk.auth.err.email"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options:
        mode === "signup"
          ? { shouldCreateUser: true, data: { full_name: name.trim() } }
          : { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) {
      toast.error(mode === "signin" ? t("bk.auth.err.noAccount") : t("bk.auth.err.send"));
      return;
    }
    toast.success(t("bk.auth.codeSent"));
    setStage("code");
  }

  async function verify() {
    if (code.replace(/\D/g, "").length !== 6) {
      toast.error(t("bk.auth.err.code6"));
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
      toast.error(t("bk.auth.err.codeInvalid"));
      return;
    }
    await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: phone.trim() })
      .eq("id", data.user.id);
    setBusy(false);
    toast.success(t("bk.auth.confirmed"));
    onDone();
  }

  if (stage === "code") {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <MailCheck className="size-4 text-primary" /> {t("bk.auth.confirmTitle")}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("bk.auth.sentTo")}<span className="font-bold text-foreground">{email}</span>.
        </p>
        <Input
          className="mt-3 h-10 text-center text-lg font-bold tracking-[0.4em]"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          aria-label={t("bk.auth.codeLabel")}
        />
        <Button className="mt-3 w-full" onClick={verify} disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} {t("bk.auth.confirmEmail")}
        </Button>
        <button
          onClick={() => setStage("details")}
          className="mt-2 w-full text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          {t("bk.auth.changeDetails")}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <ShieldCheck className="size-4 text-primary" /> {t("bk.auth.title")}
      </div>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor="cname" className="text-xs font-bold">
            {t("bk.auth.firstName")}
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
            {t("bk.auth.phone")}
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
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />} {t("bk.auth.sendCode")}
      </Button>
    </div>
  );
}
