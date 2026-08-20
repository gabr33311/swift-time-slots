import { Button } from "@/components/ui/button";
import {
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar-links";
import { CalendarPlus, Download } from "lucide-react";

export function AddToCalendar({ event }: { event: CalendarEvent }) {
  return (
    <div className="mt-6 border-t border-border pt-5 text-left">
      <p className="flex items-center gap-2 text-sm font-bold">
        <CalendarPlus className="size-4 text-primary" /> Adicionar ao calendário
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer">
          <Button variant="outline" className="w-full">
            Google Calendar
          </Button>
        </a>
        <a href={outlookCalendarUrl(event)} target="_blank" rel="noreferrer">
          <Button variant="outline" className="w-full">
            Outlook Calendar
          </Button>
        </a>
        <Button variant="outline" onClick={() => downloadIcs(event)}>
          Apple Calendar
        </Button>
        <Button variant="outline" onClick={() => downloadIcs(event)}>
          <Download className="mr-2 size-4" /> Ficheiro .ics
        </Button>
      </div>
    </div>
  );
}
