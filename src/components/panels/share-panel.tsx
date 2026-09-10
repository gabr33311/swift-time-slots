import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";
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
  const { t } = usePrefs();
  const url = business ? `${publicOrigin()}/book/${business.slug}` : "";

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: business?.name ?? t("pf.share.defaultTitle"), url });
      } catch {
        /* cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success(t("pf.share.linkCopied"));
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
    <section className="surface animate-enter flex flex-col items-center gap-6 p-8 text-center">
      {/* Link above */}
      <div className="w-full min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("pf.share.yourLink")}
        </p>
        <p className="mt-1.5 break-all text-sm font-bold leading-snug sm:text-base">
          {url.replace(/^https?:\/\//, "")}
        </p>
      </div>

      {/* Giant QR centered */}
      <div className="rounded-3xl bg-white p-4 ring-1 ring-border shadow-soft">
        {url && (
          <QRCodeCanvas
            id="booking-qr"
            value={url}
            size={compact ? 180 : 232}
            level="M"
          />
        )}
      </div>

      {/* 3 buttons below, centered */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={share}
          className="flex size-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Share2 className="size-5" strokeWidth={2.5} />
          <span className="text-[10px] font-bold">{t("pf.share.share")}</span>
        </button>
        <button
          type="button"
          onClick={() => window.open(url, "_blank", "noopener")}
          className="flex size-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Eye className="size-5" strokeWidth={2.5} />
          <span className="text-[10px] font-bold">{t("pf.share.preview")}</span>
        </button>
        <button
          type="button"
          onClick={downloadQr}
          className="flex size-12 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <Download className="size-5" strokeWidth={2.5} />
          <span className="text-[10px] font-bold">PNG</span>
        </button>
      </div>
    </section>
  );
}
