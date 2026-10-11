import { useEffect } from "react";

/** SYCRAS blue: the default for every business that hasn't picked its own. */
export const DEFAULT_BRAND = "#2563eb";
/** The old default (teal) was never a choice: treat it as "not chosen". */
const LEGACY_DEFAULT = "#0f766e";
/** Text colour used on light brand colours (deep navy reads better than black on blue). */
const DARK_TEXT = "#04263f";

/** Curated brand colours. Text on them switches to white or navy for contrast. */
export const BRAND_PALETTE = [
  "#2563eb", // SYCRAS blue
  "#0369a1", // ocean
  "#0e7490", // cyan
  "#4338ca", // indigo
  "#6d28d9", // violet
  "#be185d", // pink
  "#be123c", // rose
  "#c2410c", // orange
  "#15803d", // green
  "#18181b", // black
] as const;

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The colour a business actually uses (its own, or the SYCRAS blue). */
export function effectiveBrand(hex: string | null | undefined): string {
  const clean = (hex ?? "").trim().toLowerCase();
  if (!parseHex(clean) || clean.replace("#", "") === LEGACY_DEFAULT.slice(1)) return DEFAULT_BRAND;
  return clean.startsWith("#") ? clean : `#${clean}`;
}

/** A safe brand colour and the text colour that reads on it (white or deep navy). */
export function brandColors(hex: string | null | undefined): { brand: string; foreground: string } {
  const brand = effectiveBrand(hex);
  const l = luminance(parseHex(brand)!);
  const navy = luminance(parseHex(DARK_TEXT)!);
  const onWhite = 1.05 / (l + 0.05);
  const onNavy = (l + 0.05) / (navy + 0.05);
  return { brand, foreground: onWhite >= onNavy ? "#ffffff" : DARK_TEXT };
}

/** Applies the business colour to the whole document (also reaches dialogs and sheets). */
export function useBrandColor(hex: string | null | undefined) {
  useEffect(() => {
    const { brand, foreground } = brandColors(hex);
    const root = document.documentElement;
    root.style.setProperty("--brand", brand);
    root.style.setProperty("--brand-foreground", foreground);
    return () => {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-foreground");
    };
  }, [hex]);
}
