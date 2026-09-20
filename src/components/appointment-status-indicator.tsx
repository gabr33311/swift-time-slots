import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock3,
  HelpCircle,
  UserX,
} from "lucide-react";
import { statusLabel } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

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

/** Non-interactive status icon styled exactly like the action trigger button. */
export function AppointmentStatusIndicator({ status }: { status: string }) {
  const { lang } = usePrefs();
  const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] ?? HelpCircle;

  return (
    <span
      data-status={status}
      className={cn(
        "appointment-status-disc flex size-9 shrink-0 items-center justify-center rounded-full border border-current",
        STATUS_STYLES[status] ?? "bg-card text-muted-foreground",
      )}
      role="img"
      aria-label={statusLabel(status, lang)}
    >
      <Icon
        className={cn("size-[18px]", status === "pending" && "animate-status-shake")}
        strokeWidth={2.7}
      />
    </span>
  );
}