import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useMyBusiness } from "@/hooks/use-business";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/booking-page")({
  head: () => ({
    meta: [
      { title: "Página pública — Marca" },
      { name: "description", content: "Partilha o teu link de marcações com os clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BookingPageSettings,
});

function BookingPageSettings() {
  const { business } = useMyBusiness();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const url =
    typeof window !== "undefined" && business
      ? `${window.location.origin}/book/${business.slug}`
      : "";

  async function toggle(field: "is_published" | "seo_indexable", value: boolean) {
    if (!business) return;
    setBusy(true);
    const { error } = await supabase
      .from("businesses")
      .update({ [field]: value })
      .eq("id", business.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível guardar.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["my-business"] });
  }

  return (
    <AppShell>
      <PageHeader title="Página pública" subtitle="O link que dás aos teus clientes." />

      <section className="surface p-5">
        <p className="text-sm text-muted-foreground">O teu link</p>
        <p className="mt-1 break-all text-base font-medium">{url}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copiado.");
            }}
          >
            <Copy className="mr-2 size-4" /> Copiar
          </Button>
          <a href={url} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <ExternalLink className="mr-2 size-4" /> Abrir
            </Button>
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Marca aqui o teu horário: ${url}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline">
              <MessageCircle className="mr-2 size-4" /> Enviar por WhatsApp
            </Button>
          </a>
        </div>
      </section>

      <section className="surface mt-6 divide-y divide-border">
        <Row
          title="Página publicada"
          description="Desliga para deixar de aceitar marcações online."
          checked={business?.is_published ?? false}
          disabled={busy}
          onChange={(v) => toggle("is_published", v)}
        />
        <Row
          title="Aparecer no Google"
          description="Permite que motores de busca indexem a tua página."
          checked={business?.seo_indexable ?? false}
          disabled={busy}
          onChange={(v) => toggle("seo_indexable", v)}
        />
      </section>
    </AppShell>
  );
}

function Row({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}
