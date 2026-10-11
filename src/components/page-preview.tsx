import type { CSSProperties } from "react";
import { brandColors } from "@/lib/brand";
import { initials } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { Button } from "@/components/ui/button";

/**
 * A small live mock of the client booking page: banner, logo, colour.
 * The brand colour is scoped to this card, so the rest of the app keeps its own.
 */
export function PagePreview({
  name,
  brand,
  logoUrl,
  coverUrl,
}: {
  name: string;
  brand: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
}) {
  const { t } = usePrefs();
  const colors = brandColors(brand);
  return (
    <div
      className="mx-auto w-full max-w-xs overflow-hidden rounded-3xl border border-border bg-background shadow-lift"
      style={
        {
          "--brand": colors.brand,
          "--brand-foreground": colors.foreground,
          "--brand-ink": `color-mix(in oklch, ${colors.brand} 72%, black)`,
        } as CSSProperties
      }
      aria-label={t("pv.label")}
    >
      <div className="relative h-24 bg-brand">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full bg-[linear-gradient(140deg,oklch(1_0_0/0.18),oklch(0_0_0/0.18))]" />
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-7 flex size-14 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-brand text-sm font-bold text-brand-foreground">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(name || "S")
          )}
        </div>
        <p className="mt-2 truncate font-display text-base font-bold">{name || t("pv.name")}</p>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5">
          <span className="text-xs font-bold">{t("pv.service")}</span>
          <span className="rounded-lg border border-brand bg-brand px-2 py-1 text-[11px] font-bold text-brand-foreground">
            10:30
          </span>
        </div>
        <Button variant="brand" size="sm" type="button" tabIndex={-1} className="mt-3 w-full">
          {t("pf.brand.preview")}
        </Button>
      </div>
    </div>
  );
}
