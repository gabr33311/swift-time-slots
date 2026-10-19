-- The busy times shown on the public booking page (only the hours, never names or reasons).
-- It existed in the database but was missing from the migrations: added so a new project gets it too.
create or replace function public.public_busy_intervals(_business_id uuid, _from timestamptz, _to timestamptz)
returns table(kind text, staff_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable security definer
set search_path to 'public'
as $function$
  select 'appointment'::text, a.staff_id, a.starts_at, a.ends_at
  from public.appointments a
  join public.businesses b on b.id = a.business_id and b.is_published and b.deleted_at is null
  where a.business_id = _business_id and a.status in ('pending','confirmed')
    and a.starts_at < _to and a.ends_at > _from
  union all
  select 'block'::text, t.staff_id, t.starts_at, t.ends_at
  from public.blocked_times t
  join public.businesses b on b.id = t.business_id and b.is_published and b.deleted_at is null
  where t.business_id = _business_id and t.starts_at < _to and t.ends_at > _from
    and _to - _from <= interval '400 days'
$function$;

grant execute on function public.public_busy_intervals(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
