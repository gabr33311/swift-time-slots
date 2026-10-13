import { Check } from "lucide-react";
import { BRAND_PALETTE, MONO, brandColors } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The brand palette in one even row: swatches shrink to fit, from phones to desktop. */
export function ColorSwatches({
  value,
  onChange,
  label,
  className,
  mono,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
  className?: string;
  /** Adds the black-and-white choice that follows the theme (app colour only). */
  mono?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid max-w-md grid-cols-8 gap-2", className)}
    >
      {mono && (
        <button
          type="button"
          role="radio"
          aria-checked={value === MONO}
          aria-label={mono}
          title={mono}
          onClick={() => onChange(MONO)}
          className={cn(
            // Black on the light theme, white on the dark one.
            "flex aspect-square w-full items-center justify-center rounded-full bg-foreground ring-1 ring-border ring-offset-2 ring-offset-card transition-transform active:scale-95",
            value === MONO ? "ring-2 ring-foreground" : "hover:scale-105",
          )}
        >
          {value === MONO && (
            <Check className="size-1/2 max-h-5 max-w-5 text-background" strokeWidth={3} />
          )}
        </button>
      )}
      {/* With the black-and-white choice, plain black is left out (black on black). */}
      {BRAND_PALETTE.filter((c) => !mono || c !== "#18181b").map((c) => {
        const active = value.toLowerCase() === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn(
              "flex aspect-square w-full items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-transform active:scale-95",
              active ? "ring-2 ring-foreground" : "hover:scale-105",
            )}
            style={{ backgroundColor: c }}
          >
            {active && (
              <Check
                className="size-1/2 max-h-5 max-w-5"
                strokeWidth={3}
                style={{ color: brandColors(c).foreground }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
