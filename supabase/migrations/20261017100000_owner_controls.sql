-- Owner controls: map on/off, minimum notice, email code before booking,
-- and a paused (suspended) account.
alter table public.businesses
  add column if not exists show_map boolean not null default true,
  add column if not exists min_notice_minutes integer not null default 30,
  add column if not exists verify_bookings boolean not null default false,
  add column if not exists suspended_at timestamptz;

alter table public.businesses drop constraint if exists businesses_min_notice_check;
alter table public.businesses
  add constraint businesses_min_notice_check check (min_notice_minutes between 0 and 10080);

-- One-time codes emailed to a client before their booking is created.
-- Only the server (service role) reads or writes them.
create table if not exists public.booking_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists booking_codes_lookup on public.booking_codes (business_id, email, created_at desc);
alter table public.booking_codes enable row level security;
