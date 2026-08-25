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

/** Single compact menu with every calendar export option. */
export function AddToCalendar({ event }: { event: CalendarEvent }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="mt-2 w-full">
          <CalendarPlus className="mr-2 size-4" /> Adicionar ao calendário
          <ChevronDown className="ml-2 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuItem
          onClick={() => window.open(googleCalendarUrl(event), "_blank", "noopener")}
        >
          Google Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadIcs(event)}>Apple Calendar</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open(outlookCalendarUrl(event), "_blank", "noopener")}
        >
          Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadIcs(event)}>Ficheiro .ics</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
