import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SycrasLogo } from "@/components/sycras-logo";
import { LEGAL } from "@/lib/legal";

/** A value from LEGAL, or a visible "to fill in" marker while it is missing. */
export function Fill({ value, label }: { value: string | null; label: string }) {
  if (value) return <>{value}</>;
  return (
    <mark className="rounded bg-amber-100 px-1 font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
      [{label}]
    </mark>
  );
}

/** The responsible entity, as one line (NIF and address only when given). */
export function Entity() {
  return (
    <>
      <Fill value={LEGAL.entity} label="nome do responsável" />
      {LEGAL.nif ? `, NIF ${LEGAL.nif}` : ""}
      {LEGAL.address ? `, com morada em ${LEGAL.address}` : ""}
    </>
  );
}

export function ContactEmail() {
  return LEGAL.email ? (
    <a href={`mailto:${LEGAL.email}`} className="font-semibold text-brand-ink underline">
      {LEGAL.email}
    </a>
  ) : (
    <Fill value={null} label="email de contacto" />
  );
}

/** Layout for the legal texts: readable column, numbered sections. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="SYCRAS">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand">
              <SycrasLogo className="size-5" onColor />
            </span>
            <span className="text-sm font-extrabold tracking-[0.14em]">SYCRAS</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: {LEGAL.updated}</p>
        {!LEGAL.ready && (
          <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Versão em preparação: os campos assinalados serão preenchidos antes de a SYCRAS começar
            a cobrar subscrições.
          </p>
        )}
        <div className="legal mt-8 space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:mt-1.5 [&_p+p]:mt-3 [&_ul+p]:mt-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  );
}

/** "Termos · Privacidade" links; nothing until the legal details are filled in. */
export function LegalLinks({ className }: { className?: string }) {
  if (!LEGAL.ready) return null;
  return (
    <span className={className}>
      <Link to="/termos" className="underline-offset-4 hover:underline">
        Termos
      </Link>
      {" · "}
      <Link to="/privacidade" className="underline-offset-4 hover:underline">
        Privacidade
      </Link>
      {" · "}
      <Link to="/eliminar-conta" className="underline-offset-4 hover:underline">
        Eliminar conta
      </Link>
    </span>
  );
}
