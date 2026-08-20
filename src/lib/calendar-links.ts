function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC basic format used by iCalendar and Google Calendar: 20260101T120000Z */
export function toIcsStamp(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export type CalendarEvent = {
  title: string;
  description?: string;
  location?: string;
  startIso: string;
  endIso: string;
};

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${toIcsStamp(e.startIso)}/${toIcsStamp(e.endIso)}`,
    details: e.description ?? "",
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    body: e.description ?? "",
    location: e.location ?? "",
    startdt: new Date(e.startIso).toISOString(),
    enddt: new Date(e.endIso).toISOString(),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function escapeIcs(value: string) {
  return value.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export function icsContent(e: CalendarEvent): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Schedivo//PT",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@schedivo`,
    `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
    `DTSTART:${toIcsStamp(e.startIso)}`,
    `DTEND:${toIcsStamp(e.endIso)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    e.description ? `DESCRIPTION:${escapeIcs(e.description)}` : "",
    e.location ? `LOCATION:${escapeIcs(e.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function downloadIcs(e: CalendarEvent, filename = "marcacao.ics") {
  const blob = new Blob([icsContent(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
