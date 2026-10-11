-- Phones that receive push notifications (one row per app install).
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

drop policy if exists "own tokens read" on public.push_tokens;
create policy "own tokens read" on public.push_tokens for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "own tokens write" on public.push_tokens;
create policy "own tokens write" on public.push_tokens for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "own tokens update" on public.push_tokens;
create policy "own tokens update" on public.push_tokens for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own tokens delete" on public.push_tokens;
create policy "own tokens delete" on public.push_tokens for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.push_tokens to service_role;
