-- 1. Storage for logos and banners (private; the public page uses signed URLs).
insert into storage.buckets (id, name, public)
values ('business-logos', 'business-logos', false)
on conflict (id) do nothing;

drop policy if exists "logos_read_members" on storage.objects;
create policy "logos_read_members" on storage.objects for select to authenticated
using (bucket_id = 'business-logos' and exists (
  select 1 from public.business_members m
  where m.user_id = auth.uid() and m.business_id::text = (storage.foldername(name))[1]
));
drop policy if exists "logos_write_managers" on storage.objects;
create policy "logos_write_managers" on storage.objects for insert to authenticated
with check (bucket_id = 'business-logos' and public.can_manage_business(((storage.foldername(name))[1])::uuid));
drop policy if exists "logos_update_managers" on storage.objects;
create policy "logos_update_managers" on storage.objects for update to authenticated
using (bucket_id = 'business-logos' and public.can_manage_business(((storage.foldername(name))[1])::uuid));
drop policy if exists "logos_delete_managers" on storage.objects;
create policy "logos_delete_managers" on storage.objects for delete to authenticated
using (bucket_id = 'business-logos' and public.can_manage_business(((storage.foldername(name))[1])::uuid));

-- 2. Online bookings: pending only when the service asks for approval.
-- Anything not inserted by the server (service role) is still forced to pending.
create or replace function public.enforce_public_booking_pending()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source = 'public' then
    if coalesce(auth.role(), '') <> 'service_role'
       or exists (
         select 1 from public.services s
         where s.id = new.service_id and s.requires_confirmation
       ) then
      new.status := 'pending'::public.appointment_status;
    end if;
  end if;
  return new;
end;
$$;

-- 3. Exact shop location, picked on a map.
alter table public.businesses
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
