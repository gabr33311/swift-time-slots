-- Pro: automatic email reminders to clients before their appointment.
alter table public.businesses
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminder_hours integer not null default 24
    check (reminder_hours between 1 and 72);
