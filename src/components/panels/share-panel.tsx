import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";
import { useMyBusiness } from "@/hooks/use-business";
import { QRCodeCanvas } from "qrcode.react";
import { Share2, Download, Eye, Copy } from "lucide-react";

/** Shortened, single-line display of the public booking URL. */
function shortUrl(url: string): string {
  const clean = url.replace(/^https?:\/\//, "");
  const [host, ...rest] = clean.split("/");
  const path = rest.join("/");
  const shortHost = (host ?? "").length > 22 ? `${(host ?? "").slice(0, 20)}…` : (host ?? "");
  return path ? `${shortHost}/${path}` : shortHost;
}

/** Clean, shareable domain — preview/localhost hosts are never shown to clients. */
const PUBLIC_ORIGIN = "https://sycras.com";

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

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    toast.success(t("pf.share.linkCopied"));
  }

  function downloadQr() {
    const canvas = document.getElementById("booking-qr") as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${business?.slug ?? "sycras"}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <section className="animate-enter flex flex-col items-center gap-6 text-center sm:gap-8">
      {/* Link above */}
      <div className="w-full min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("pf.share.yourLink")}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <p className="max-w-[70%] truncate text-sm font-bold leading-snug sm:text-base">
            {shortUrl(url)}
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="action-gradient-outline flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-foreground"
          >
            <Copy className="size-3.5" strokeWidth={2.5} />
            {t("pf.share.copy")}
          </button>
        </div>
      </div>

      {/* Giant QR centered, no border/frame */}
      {url && (
        <QRCodeCanvas
          id="booking-qr"
          value={url}
          size={compact ? 180 : 240}
          level="M"
        />
      )}

      {/* 3 buttons below, larger */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={share}
          className="action-gradient-outline flex w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border px-3 py-3 text-foreground"
        >
          <Share2 className="size-6" strokeWidth={2.5} />
          <span className="text-xs font-bold">{t("pf.share.share")}</span>
        </button>
        <button
          type="button"
          onClick={() => window.open(url, "_blank", "noopener")}
          className="action-gradient-outline flex w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border px-3 py-3 text-foreground"
        >
          <Eye className="size-6" strokeWidth={2.5} />
          <span className="text-xs font-bold">{t("pf.share.preview")}</span>
        </button>
        <button
          type="button"
          onClick={downloadQr}
          className="action-gradient-outline flex w-24 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border px-3 py-3 text-foreground"
        >
          <Download className="size-6" strokeWidth={2.5} />
          <span className="text-xs font-bold">PNG</span>
        </button>
      </div>
    </section>
  );
}
