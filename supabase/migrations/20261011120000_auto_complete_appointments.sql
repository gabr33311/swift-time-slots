-- Optional automation: confirmed appointments close themselves once they end.
alter table public.businesses
  add column if not exists auto_complete boolean not null default false;

create or replace function public.auto_complete_appointments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  done integer := 0;
begin
  with closed as (
    update public.appointments a
       set status = 'completed'
      from public.businesses b
     where b.id = a.business_id
       and b.auto_complete
       and a.status = 'confirmed'
       and a.ends_at <= now()
    returning a.id, a.business_id
  )
  insert into public.appointment_status_history (appointment_id, business_id, status, note)
  select id, business_id, 'completed', 'auto' from closed;

  get diagnostics done = row_count;
  return done;
end;
$$;

revoke all on function public.auto_complete_appointments() from public, anon, authenticated;
grant execute on function public.auto_complete_appointments() to service_role;

select cron.schedule('sycras-auto-complete', '*/10 * * * *', $$select public.auto_complete_appointments();$$)
where not exists (select 1 from cron.job where jobname = 'sycras-auto-complete');
