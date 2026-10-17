-- The example booking page linked from the homepage: sycras.com/exemplo.
-- A demo business (is_demo = true) with no owner account: it shows how the
-- client side works, and the server never saves bookings made on it.
-- Fixed ids, so running this again changes nothing; if someone already took
-- the "exemplo" link, nothing is created.
do $$
declare
  demo constant uuid := '5c0a5000-0000-4000-8000-000000000001';
  rui constant uuid := '5c0a5000-0000-4000-8000-000000000021';
begin
  if exists (select 1 from public.businesses where slug = 'exemplo' and id <> demo) then
    raise notice 'The "exemplo" link is taken: demo page not created.';
    return;
  end if;

  insert into public.businesses (
    id, slug, name, business_type, description, address, city, latitude, longitude,
    brand_color, timezone, currency, cancellation_hours, slot_interval_minutes,
    is_published, onboarding_completed, is_demo, show_map, show_contacts, show_team,
    seo_indexable, created_by
  )
  values (
    demo, 'exemplo', 'Barbearia Exemplo', 'other',
    'Página de demonstração da SYCRAS. Escolhe um serviço e um horário para veres como os teus clientes marcam.',
    'Rua Augusta 100', 'Lisboa', 38.7107, -9.1368,
    '#0a6cf0', 'Europe/Lisbon', 'EUR', 24, 15,
    true, true, true, true, false, true,
    false, '00000000-0000-0000-0000-000000000000'
  )
  on conflict do nothing;

  insert into public.services (id, business_id, name, description, price_cents, duration_minutes, buffer_minutes, is_active, requires_confirmation, sort_order)
  values
    ('5c0a5000-0000-4000-8000-000000000011', demo, 'Corte', 'Corte clássico ou moderno, com acabamento.', 1500, 30, 0, true, false, 1),
    ('5c0a5000-0000-4000-8000-000000000012', demo, 'Corte + Barba', 'Corte completo e barba aparada à navalha.', 2000, 45, 0, true, false, 2),
    ('5c0a5000-0000-4000-8000-000000000013', demo, 'Barba', 'Barba desenhada e toalha quente.', 1000, 20, 0, true, false, 3)
  on conflict do nothing;

  insert into public.staff (id, business_id, name, specialty, is_active, sort_order)
  values (rui, demo, 'Rui', 'Barbeiro', true, 1)
  on conflict do nothing;

  insert into public.staff_services (staff_id, service_id, business_id)
  select rui, s.id, demo from public.services s where s.business_id = demo
  on conflict do nothing;

  -- Monday to Saturday, 09:00–19:00 (weekday 0 = Sunday).
  insert into public.working_hours (business_id, staff_id, weekday, start_time, end_time)
  select demo, null, d, '09:00', '19:00'
  from generate_series(1, 6) as d
  where not exists (
    select 1 from public.working_hours w where w.business_id = demo and w.weekday = d
  );

  -- Always "paying", so the page never closes when a free trial would end.
  insert into public.subscriptions (business_id, plan, status, current_period_end)
  values (demo, 'pro', 'active', '2099-12-31')
  on conflict (business_id) do nothing;
end $$;
