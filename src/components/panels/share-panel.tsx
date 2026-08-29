import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { QRCodeCanvas } from "qrcode.react";
import { Share2, Download, Eye } from "lucide-react";

/** Clean, shareable domain — preview/localhost hosts are never shown to clients. */
const PUBLIC_ORIGIN = "https://swift-time-slots.lovable.app";

function publicOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_ORIGIN;
  const host = window.location.hostname;
  const isPreview = host.includes("id-preview") || host === "localhost" || host.endsWith(".local");
  return isPreview ? PUBLIC_ORIGIN : window.location.origin;
}

export function SharePanel({ compact = false }: { compact?: boolean }) {
  const { business } = useMyBusiness();
  const url = business ? `${publicOrigin()}/book/${business.slug}` : "";

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: business?.name ?? "Marcações", url });
      } catch {
        /* cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado.");
  }

  function downloadQr() {
    const canvas = document.getElementById("booking-qr") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${business?.slug ?? "schedivo"}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <section className="surface flex flex-row items-center gap-4 p-5">
      <div className="shrink-0 rounded-2xl bg-card p-2.5 ring-1 ring-border">
        {url && (
          <QRCodeCanvas id="booking-qr" value={url} size={compact ? 88 : 104} level="M" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            O teu link
          </p>
          <p className="mt-1 break-all text-[13px] font-bold leading-snug sm:text-sm">
            {url.replace(/^https?:\/\//, "")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={share}>
            <Share2 className="size-4" /> Partilhar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(url, "_blank", "noopener")}
          >
            <Eye className="size-4" /> Pré-visualizar
          </Button>
          <Button size="sm" variant="outline" onClick={downloadQr}>
            <Download className="size-4" /> PNG
          </Button>
        </div>
      </div>
    </section>
  );
}

