import {
  BadgeCheck,
  CalendarCheck,
  CircleCheck,
  CircleX,
  Clock3,
  HelpCircle,
  UserX,
  XCircle,
} from "lucide-react";
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

const STATUS_STYLES: Record<string, string> = {
  pending: "appointment-status-pending",
  confirmed: "appointment-status-confirmed",
  completed: "appointment-status-completed",
  cancelled: "appointment-status-cancelled",
  no_show: "appointment-status-cancelled",
};

const STATUS_ICONS = {
  pending: Clock3,
  confirmed: CircleCheck,
  completed: BadgeCheck,
  cancelled: CircleX,
  no_show: UserX,
} as const;

/**
 * Status disc — colored background by status, gray icon inside.
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
  const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] ?? HelpCircle;
  const isInteractivePending = status === "pending" && !!onConfirm && !!onCancel;
  const label = statusLabel(status, lang);

  const discClass = cn(
    "appointment-status-disc flex size-9 shrink-0 items-center justify-center rounded-full border border-current",
    STATUS_STYLES[status] ?? "bg-card text-muted-foreground",
  );

  const icon = (
    <Icon
      className={cn(
        "size-[18px] text-muted-foreground",
        status === "pending" && "animate-status-shake",
      )}
      strokeWidth={2.7}
    />
  );

  if (isInteractivePending) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-status={status}
            className={discClass}
            aria-label={`${t("acts.opts.forLabel")}${customerName ?? ""}`}
          >
            {icon}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 space-y-1 p-1.5">
          <DropdownMenuItem
            className="py-2.5 font-bold"
            style={{ color: "var(--appointment-confirmed-start)" }}
            onClick={onConfirm}
          >
            <CalendarCheck className="mr-1 size-4" /> {t("acts.confirm")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="py-2.5 font-bold"
            style={{ color: "var(--appointment-cancelled-start)" }}
            onClick={onCancel}
          >
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
          className={discClass}
          aria-label={label}
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto text-sm font-bold">
        {label}
      </PopoverContent>
    </Popover>
  );
}
