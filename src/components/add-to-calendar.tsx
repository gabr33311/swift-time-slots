import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar-links";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { usePrefs } from "@/lib/prefs";

/** Single compact menu with every calendar export option. */
export function AddToCalendar({ event }: { event: CalendarEvent }) {
  const { t } = usePrefs();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="mt-2 w-full">
          <CalendarPlus className="mr-2 size-4" /> {t("cal.add.button")}
          <ChevronDown className="ml-2 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuItem
          onClick={() => window.open(googleCalendarUrl(event), "_blank", "noopener")}
        >
          {t("cal.add.google")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadIcs(event)}>{t("cal.add.apple")}</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(outlookCalendarUrl(event), "_blank", "noopener")}
        >
          {t("cal.add.outlook")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadIcs(event)}>{t("cal.add.ics")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
