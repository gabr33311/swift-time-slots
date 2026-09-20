import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock3,
  HelpCircle,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export function AppointmentStatusIndicator({ status }: { status: string }) {
  const { lang } = usePrefs();
  const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] ?? HelpCircle;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-9 shrink-0 rounded-full border bg-card/85 shadow-sm backdrop-blur-sm",
            STATUS_STYLES[status] ?? "text-muted-foreground",
          )}
          aria-label={statusLabel(status, lang)}
        >
          <Icon
            className={cn("size-[18px]", status === "pending" && "animate-status-shake")}
            strokeWidth={2.7}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-auto rounded-full px-3 py-1.5">
        <span className="text-xs font-bold">{statusLabel(status, lang)}</span>
      </PopoverContent>
    </Popover>
  );
}