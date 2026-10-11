import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrefs } from "@/lib/prefs";

export type CropShape = "logo" | "cover";

/** Aspect and final size for each kind of image. */
const SHAPES: Record<CropShape, { aspect: number; width: number }> = {
  logo: { aspect: 1, width: 512 },
  cover: { aspect: 16 / 6, width: 1600 },
};

/** Draws the chosen area into a canvas at a fixed width and returns it as WebP. */
async function cropToBlob(src: string, area: Area, width: number): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = src;
  });
  const scale = Math.min(1, width / area.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("empty"))), "image/webp", 0.88),
  );
}

/**
 * Lets the owner frame a picture before it is saved: drag to move, pinch or
 * slide to zoom. Returns a ready-to-upload file.
 */
export function ImageCropDialog({
  file,
  shape,
  onCancel,
  onDone,
}: {
  file: File | null;
  shape: CropShape;
  onCancel: () => void;
  onDone: (file: File) => void | Promise<void>;
}) {
  const { t } = usePrefs();
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const { aspect, width } = SHAPES[shape];

  useEffect(() => {
    if (!file) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function confirm() {
    if (!src || !area) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(src, area, width);
      await onDone(new File([blob], `${shape}.webp`, { type: "image/webp" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent className="max-w-lg gap-4">
        <DialogHeader>
          <DialogTitle>{shape === "logo" ? t("crop.logo") : t("crop.cover")}</DialogTitle>
          <DialogDescription>{t("crop.hint")}</DialogDescription>
        </DialogHeader>
        <div className="relative h-72 overflow-hidden rounded-xl bg-muted sm:h-80">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={shape === "logo" ? "round" : "rect"}
              showGrid={false}
              objectFit={shape === "cover" ? "horizontal-cover" : "contain"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <ZoomOut className="size-4 shrink-0 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={([v]) => setZoom(v ?? 1)}
            aria-label={t("crop.zoom")}
          />
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {t("ui.save.cancel")}
          </Button>
          <Button onClick={() => void confirm()} disabled={busy || !area}>
            {busy && <Loader2 className="animate-spin" />}
            {t("crop.use")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
