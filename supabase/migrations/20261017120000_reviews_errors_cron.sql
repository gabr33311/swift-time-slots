-- 1) "How did it go?" email after a visit, with the business's review link (Google, etc.).
alter table public.businesses
  add column if not exists review_url text;

-- 2) Crashes and errors from the phone app, so they are seen (no external service needed).
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  platform text,
  app_version text,
  screen text,
  message text not null,
  stack text,
  created_at timestamptz not null default now()
);
create index if not exists app_errors_created on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
grant insert on public.app_errors to anon, authenticated;
grant all on public.app_errors to service_role;
drop policy if exists "App reports errors" on public.app_errors;
create policy "App reports errors" on public.app_errors
  for insert to anon, authenticated
  with check (
    length(message) <= 2000
    and (stack is null or length(stack) <= 8000)
    and (user_id is null or user_id = auth.uid())
  );

-- 3) Scheduled jobs kept in the code (not only set up by hand in the dashboard).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Reminder and review emails: every 10 minutes the site sends what is due.
-- Needs the secret in Vault once: select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- (the same value as CRON_SECRET in Vercel). Running twice never sends twice.
select cron.unschedule(jobid) from cron.job where jobname = 'sycras-email-reminders';
select cron.schedule(
  'sycras-email-reminders',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://sycras.com/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Expired booking codes and old app errors: cleaned every night.
select cron.unschedule(jobid) from cron.job where jobname = 'sycras-cleanup';
select cron.schedule(
  'sycras-cleanup',
  '30 3 * * *',
  $$
  delete from public.booking_codes where expires_at < now() - interval '1 day';
  delete from public.app_errors where created_at < now() - interval '90 days';
  $$
);
