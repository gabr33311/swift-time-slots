-- Reminders: the business writes its own message and picks any lead time (up to 7 days).
alter table public.businesses
  add column if not exists reminder_message text
    check (reminder_message is null or char_length(reminder_message) <= 600);

alter table public.businesses drop constraint if exists businesses_reminder_hours_check;
alter table public.businesses
  add constraint businesses_reminder_hours_check check (reminder_hours between 1 and 168);
