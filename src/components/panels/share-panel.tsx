import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, ExternalLink, Share2, Download } from "lucide-react";

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
    <section className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 self-center rounded-xl bg-card p-2 ring-1 ring-border">
        {url && (
          <QRCodeCanvas id="booking-qr" value={url} size={compact ? 92 : 108} level="M" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="break-all rounded-lg bg-muted px-3 py-2 text-sm font-bold">
          {url.replace(/^https?:\/\//, "")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(url);
              toast.success("Link copiado.");
            }}
          >
            <Copy className="mr-1.5 size-4" /> Copiar link
          </Button>
          <Button size="sm" variant="outline" onClick={share}>
            <Share2 className="mr-1.5 size-4" /> Partilhar
          </Button>
          <a href={url} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              <ExternalLink className="mr-1.5 size-4" /> Ver página
            </Button>
          </a>
          <Button size="sm" variant="outline" onClick={downloadQr}>
            <Download className="mr-1.5 size-4" /> Transferir PNG
          </Button>
        </div>
      </div>
    </section>
  );
}
