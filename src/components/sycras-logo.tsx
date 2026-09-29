import darkMark from "@/assets/sycras-logo-dark.png.asset.json";
import lightMark from "@/assets/sycras-logo-light.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Brand mark that swaps with the theme:
 * - light theme → black "S" on transparent background
 * - dark theme  → white "S" on transparent background
 */
export function SycrasLogo({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)}>
      <img
        src={darkMark.url}
        alt="SYCRAS"
        className="size-full object-contain dark:hidden"
        draggable={false}
      />
      <img
        src={lightMark.url}
        alt="SYCRAS"
        aria-hidden="true"
        className="hidden size-full object-contain dark:block"
        draggable={false}
      />
    </span>
  );
}
