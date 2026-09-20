import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { maskPhonePt, isValidPhonePt, normalizePhonePt } from "@/lib/phone";
import { usePrefs } from "@/lib/prefs";

const emailSchema = z.string().trim().email().max(160);

const signupSchema = z.object({
  name: z.string().trim().min(2, "bk.auth.err.name").max(80),
  email: z.string().trim().email("bk.auth.err.email").max(160),
  password: z.string().min(8, "bk.auth.err.password"),
});

/**
 * Client account step: sign in with Google or email + password, or create an
 * account (name, phone, email, password) confirmed by a code sent by email.
 */
export function ClientAuthStep({ onDone }: { onDone: () => void }) {
  const { t } = usePrefs();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [stage, setStage] = useState<"details" | "code" | "profile">("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  /** Name and phone are mandatory for every client, Google accounts included. */
  async function requireProfile(): Promise<boolean> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", auth.user.id)
      .maybeSingle();
    const fullName = profile?.full_name?.trim() ?? "";
    const tel = profile?.phone?.trim() ?? "";
    if (fullName && tel) return true;
    setName(fullName || (auth.user.user_metadata?.["full_name"] as string | undefined) || "");
    setPhone(tel ? maskPhonePt(tel) : "");
    setStage("profile");
    return false;
  }

  useEffect(() => {
    void requireProfile();
  }, []);

  async function saveRequiredProfile() {
    if (name.trim().length < 2) {
      toast.error(t("bk.auth.err.name"));
      return;
    }
    if (!isValidPhonePt(phone)) {
      toast.error(t("bk.auth.err.phone"));
      return;
    }
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setBusy(false);
      setStage("details");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: normalizePhonePt(phone) })
      .eq("id", auth.user.id);
    setBusy(false);
    if (error) {
      toast.error(t("bk.auth.err.check"));
      return;
    }
    onDone();
  }

  async function signIn() {
    if (!emailSchema.safeParse(email).success) {
      toast.error(t("bk.auth.err.email"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("bk.auth.err.password"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(t("bk.auth.err.invalidLogin"));
      return;
    }
    if (await requireProfile()) onDone();
  }

  async function signUp() {
    const parsed = signupSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "bk.auth.err.check"));
      return;
    }
    if (!isValidPhonePt(phone)) {
      toast.error(t("bk.auth.err.phone"));
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.href,
        data: { full_name: name.trim(), phone: phone.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.includes("registered") ? t("bk.auth.err.exists") : t("bk.auth.err.send"),
      );
      return;
    }
    if (data.session) {
      await saveProfile(data.session.user.id);
      toast.success(t("bk.auth.confirmed"));
      onDone();
      return;
    }
    toast.success(t("bk.auth.verifySent"));
    setStage("code");
  }

  async function saveProfile(userId: string) {
    await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: normalizePhonePt(phone) })
      .eq("id", userId);
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
      type: "signup",
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error(t("bk.auth.err.codeInvalid"));
      return;
    }
    await saveProfile(data.user.id);
    setBusy(false);
    toast.success(t("bk.auth.confirmed"));
    onDone();
  }

  if (stage === "profile") {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <ShieldCheck className="size-4 text-primary" /> {t("bk.auth.completeTitle")}
        </div>
        <p className="text-sm text-muted-foreground">{t("bk.auth.completeDesc")}</p>
        <div className="mt-3 space-y-2.5">
          <div className="space-y-1">
            <Label htmlFor="pname" className="text-xs font-bold">
              {t("bk.auth.firstName")}
            </Label>
            <Input
              id="pname"
              className="h-9"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pphone" className="text-xs font-bold">
              {t("bk.auth.phone")}
            </Label>
            <Input
              id="pphone"
              className="h-9"
              inputMode="tel"
              value={phone}
              placeholder="912 345 678"
              onChange={(e) => setPhone(maskPhonePt(e.target.value))}
            />
          </div>
        </div>
        <Button className="mt-3 w-full" onClick={saveRequiredProfile} disabled={busy}>
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />} {t("bk.auth.completeCta")}
        </Button>
      </div>
    );
  }

  if (stage === "code") {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold">
          <MailCheck className="size-4 text-primary" /> {t("bk.auth.confirmTitle")}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("bk.auth.sentTo")}
          <span className="font-bold text-foreground">{email}</span>. {t("bk.auth.linkOrCode")}
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
        <p className="mt-2 text-center text-[11px] font-semibold text-muted-foreground">
          {t("bk.auth.smsSoon")}
        </p>
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
      <div className="mb-3 flex gap-1 rounded-full bg-muted p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors ${
              mode === m
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(m === "signin" ? "bk.auth.tab.signin" : "bk.auth.tab.signup")}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {mode === "signup" && (
          <>
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
          </>
        )}
        <div className="space-y-1">
          <Label htmlFor="cemail" className="text-xs font-bold">
            Email
          </Label>
          <Input
            id="cemail"
            className="h-9"
            type="email"
            autoComplete="email"
            value={email}
            maxLength={160}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cpass" className="text-xs font-bold">
            {t("bk.auth.password")}
          </Label>
          <Input
            id="cpass"
            className="h-9"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            maxLength={72}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "signup" && (
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("bk.auth.passwordHint")}
            </p>
          )}
        </div>
      </div>

      <Button className="mt-3 w-full" onClick={mode === "signin" ? signIn : signUp} disabled={busy}>
        {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
        {t(mode === "signin" ? "bk.auth.signinCta" : "bk.auth.signupCta")}
      </Button>
    </div>
  );
}
