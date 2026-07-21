-- DealBrief accounts + subscriptions + usage metering.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor).
--
-- Billing model (see src/lib/billing.ts — keep in sync):
--   • 1 free address run per account (no card).
--   • $29/mo subscription, 20 runs included, $2/run overage (auto-charged).
--   • Trial: first 14 days OR first 10 runs, whichever comes first.
--   • The meter counts SUCCESSFUL ADDRESS RUNS, never PDF downloads.

-- ── profiles: 1:1 with auth.users ────────────────────────────────────────────
create table if not exists public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  stripe_customer_id text unique,
  free_run_used      boolean not null default false,   -- the 1 free run hook
  created_at         timestamptz not null default now()
);

-- ── subscriptions: mirror of the Stripe subscription (webhook is source of truth)
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  -- trialing | active | past_due | canceled | incomplete | incomplete_expired | unpaid
  status                 text not null default 'incomplete',
  included_runs          integer not null default 20,
  trial_run_cap          integer not null default 10,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);

-- ── report_runs: the meter. One row per SUCCESSFUL address run. ───────────────
create table if not exists public.report_runs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references public.profiles(id) on delete set null,
  address               text,
  -- which subscription period this run counts toward (null for free/unclaimed)
  billing_period_start  timestamptz,
  is_free               boolean not null default false,  -- consumed the free run
  is_overage            boolean not null default false,  -- beyond included_runs
  stripe_usage_reported boolean not null default false,  -- overage pushed to Stripe
  created_at            timestamptz not null default now()
);
create index if not exists report_runs_user_created_idx on public.report_runs(user_id, created_at);
create index if not exists report_runs_user_period_idx  on public.report_runs(user_id, billing_period_start);

-- ── auto-create a profile row when a new auth user signs up ───────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS: API routes use the service_role key (bypasses RLS). These policies
--    only govern the browser (anon key) reading its OWN rows. All writes stay
--    server-side. ───────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.subscriptions enable row level security;
alter table public.report_runs   enable row level security;

drop policy if exists "self read profile" on public.profiles;
create policy "self read profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "self read subscription" on public.subscriptions;
create policy "self read subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "self read runs" on public.report_runs;
create policy "self read runs" on public.report_runs
  for select using (auth.uid() = user_id);
