-- Subscriptions bought inside the phone app (Google Play / App Store, through
-- RevenueCat) live on the same row as Stripe ones, so Pro unlocks everywhere.
alter table public.subscriptions
  add column if not exists store text not null default 'stripe',
  add column if not exists store_subscription_id text;

alter table public.subscriptions drop constraint if exists subscriptions_store_check;
alter table public.subscriptions
  add constraint subscriptions_store_check check (store in ('stripe', 'play_store', 'app_store'));
