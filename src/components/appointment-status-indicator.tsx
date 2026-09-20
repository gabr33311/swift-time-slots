import { CalendarCheck, XCircle } from "lucide-react";
import { statusLabel } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Monochrome status differentiation (no color, pure contrast):
 * - confirmed: solid filled chip (strongest)
 * - pending: outlined chip, pulsing halo
 * - completed: soft filled chip, dimmed
 * - cancelled / no_show: faint text, strikethrough
 */
const STATUS_CHIP: Record<string, string> = {
  confirmed: "bg-foreground text-background border-transparent",
  pending: "border-foreground/50 text-foreground pending-halo",
  completed: "bg-muted text-muted-foreground border-transparent",
  cancelled: "border-transparent text-muted-foreground/60 line-through",
  no_show: "border-transparent text-muted-foreground/60 line-through",
};

/**
 * Status text chip — the label replaces the old icon disc.
 * When pending + onConfirm/onCancel provided: clickable dropdown (Confirm/Cancel).
 * Otherwise: clickable popover showing the status label text.
 */
export function AppointmentStatusIndicator({
  status,
  onConfirm,
  onCancel,
  customerName,
}: {
  status: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  customerName?: string;
}) {
  const { lang, t } = usePrefs();
  const isInteractivePending = status === "pending" && !!onConfirm && !!onCancel;
  const label = statusLabel(status, lang);

  const chipClass = cn(
    "flex h-9 shrink-0 items-center rounded-full border px-3 text-[11px] font-black uppercase tracking-wider whitespace-nowrap",
    STATUS_CHIP[status] ?? "bg-card text-muted-foreground border-border",
  );

  if (isInteractivePending) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-status={status}
            className={chipClass}
            aria-label={`${t("acts.opts.forLabel")}${customerName ?? ""}`}
          >
            {label}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 space-y-1 p-1.5">
          <DropdownMenuItem className="py-2.5 font-bold" onClick={onConfirm}>
            <CalendarCheck className="mr-1 size-4" /> {t("acts.confirm")}
          </DropdownMenuItem>
          <DropdownMenuItem className="py-2.5 font-bold" onClick={onCancel}>
            <XCircle className="mr-1 size-4" /> {t("acts.cancelAppt")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-status={status}
          className={chipClass}
          aria-label={label}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto text-sm font-bold">
        {label}
      </PopoverContent>
    </Popover>
  );
}
