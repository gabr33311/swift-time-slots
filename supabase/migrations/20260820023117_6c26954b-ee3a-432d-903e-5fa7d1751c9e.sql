create policy "logos_read_members" on storage.objects for select to authenticated
using (bucket_id = 'business-logos' and exists (
  select 1 from public.business_members m
  where m.user_id = auth.uid() and m.business_id::text = (storage.foldername(name))[1]
));
create policy "logos_write_managers" on storage.objects for insert to authenticated
with check (bucket_id = 'business-logos' and public.can_manage_business(((storage.foldername(name))[1])::uuid));
create policy "logos_update_managers" on storage.objects for update to authenticated
using (bucket_id = 'business-logos' and public.can_manage_business(((storage.foldername(name))[1])::uuid));
create policy "logos_delete_managers" on storage.objects for delete to authenticated
using (bucket_id = 'business-logos' and public.can_manage_business(((storage.foldername(name))[1])::uuid));