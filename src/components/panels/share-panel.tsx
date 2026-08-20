import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMyBusiness } from "@/hooks/use-business";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, ExternalLink, Share2, QrCode, Download } from "lucide-react";

export function SharePanel({ compact = false }: { compact?: boolean }) {
  const { business } = useMyBusiness();
  const url =
    typeof window !== "undefined" && business
      ? `${window.location.origin}/book/${business.slug}`
      : "";

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
    <section className="surface p-5">
      <div className="flex items-center gap-2">
        <Share2 className="size-4 text-primary" />
        <h2 className="text-sm font-bold">Página de marcações</h2>
      </div>
      <p className="mt-3 break-all rounded-lg bg-muted px-3 py-2 text-sm font-bold">{url}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("Link copiado.");
          }}
        >
          <Copy className="mr-2 size-4" /> Copiar link
        </Button>
        <Button variant="outline" onClick={share}>
          <Share2 className="mr-2 size-4" /> Partilhar
        </Button>
        <a href={url} target="_blank" rel="noreferrer">
          <Button variant="outline">
            <ExternalLink className="mr-2 size-4" /> Ver página
          </Button>
        </a>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center gap-2">
          <QrCode className="size-4 text-primary" />
          <h3 className="text-sm font-bold">Código QR</h3>
        </div>
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
            {url && (
              <QRCodeCanvas
                id="booking-qr"
                value={url}
                size={compact ? 132 : 168}
                level="M"
                includeMargin
              />
            )}
          </div>
          <Button variant="outline" onClick={downloadQr}>
            <Download className="mr-2 size-4" /> Transferir PNG
          </Button>
        </div>
      </div>
    </section>
  );
}
