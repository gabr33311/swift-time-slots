create extension if not exists pg_cron with schema extensions;

create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null default '24h',
  created_at timestamptz not null default now(),
  unique (appointment_id, kind)
);

grant select on public.appointment_reminders to authenticated;
grant all on public.appointment_reminders to service_role;

alter table public.appointment_reminders enable row level security;

create policy "Members read reminders"
  on public.appointment_reminders for select to authenticated
  using (public.can_manage_business(business_id));

create or replace function public.generate_appointment_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer := 0;
begin
  with due as (
    select a.id, a.business_id, a.customer_name, a.service_name, a.starts_at
    from public.appointments a
    where a.status in ('pending','confirmed')
      and a.starts_at > now()
      and a.starts_at <= now() + interval '25 hours'
      and not exists (
        select 1 from public.appointment_reminders r
        where r.appointment_id = a.id and r.kind = '24h'
      )
  ), ins as (
    insert into public.appointment_reminders (appointment_id, business_id, kind)
    select id, business_id, '24h' from due
    on conflict do nothing
    returning appointment_id
  )
  insert into public.notifications (business_id, type, title, body, appointment_id)
  select d.business_id, 'appointment_reminder', 'Lembrete: marcação nas próximas 24h',
         d.customer_name || ' — ' || d.service_name,
         d.id
  from due d
  join ins on ins.appointment_id = d.id;

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.generate_appointment_reminders() from public, anon, authenticated;
grant execute on function public.generate_appointment_reminders() to service_role;

select cron.schedule('schedivo-24h-reminders', '0 * * * *', $$select public.generate_appointment_reminders();$$)
where not exists (select 1 from cron.job where jobname = 'schedivo-24h-reminders');