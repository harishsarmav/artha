-- Artha v0.6 production schema. Safe to re-run over the v0.6 foundation.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  age integer,
  dependents integer not null default 0,
  country text not null default 'India',
  risk_profile text,
  investment_horizon text,
  primary_goal text,
  life_cover numeric not null default 0,
  health_cover numeric not null default 0,
  cash_savings numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles add column if not exists cash_savings numeric not null default 0;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.income (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, type text not null, amount numeric not null check (amount >= 0), frequency text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, category text not null, amount numeric not null check (amount >= 0), frequency text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, type text not null, category text, mode text, monthly_amount numeric not null default 0 check (monthly_amount >= 0),
  invested_amount numeric not null default 0 check (invested_amount >= 0), current_value numeric not null default 0 check (current_value >= 0),
  start_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, type text not null, original_amount numeric not null default 0 check (original_amount >= 0), outstanding numeric not null default 0 check (outstanding >= 0),
  emi numeric not null default 0 check (emi >= 0), interest_rate numeric not null default 0 check (interest_rate >= 0), tenure_months integer not null default 0 check (tenure_months >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.insurance (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, provider text, coverage numeric not null default 0 check (coverage >= 0), premium numeric not null default 0 check (premium >= 0),
  frequency text, renewal_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, target_amount numeric not null check (target_amount >= 0), current_amount numeric not null default 0 check (current_amount >= 0), target_date date not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  transaction_date date not null, description text not null, amount numeric not null check (amount >= 0), transaction_type text not null,
  category text, source text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);
create index if not exists ai_usage_user_date_idx on public.ai_usage(user_id, usage_date desc);

create index if not exists income_user_id_idx on public.income(user_id);
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists investments_user_id_idx on public.investments(user_id);
create index if not exists loans_user_id_idx on public.loans(user_id);
create index if not exists insurance_user_id_idx on public.insurance(user_id);
create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

do $do$
declare t text;
begin
  foreach t in array array['income','expenses','investments','loans','insurance','goals','transactions'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$do$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.investments enable row level security;
alter table public.loans enable row level security;
alter table public.insurance enable row level security;
alter table public.goals enable row level security;
alter table public.transactions enable row level security;
alter table public.ai_usage enable row level security;

drop policy if exists "profiles owner" on public.profiles;
drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles select own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles update own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profiles delete own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

do $policies$
declare t text;
begin
  foreach t in array array['income','expenses','investments','loans','insurance','goals','transactions'] loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format('drop policy if exists %I_select_own on public.%I', t, t);
    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format('create policy %I_select_own on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_insert_own on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_update_own on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t, t);
    execute format('create policy %I_delete_own on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t, t);
  end loop;
end
$policies$;


-- AI usage is readable only by its owner. Mutations are performed only through
-- the SECURITY DEFINER quota function installed by 002_security_hardening.sql.
drop policy if exists ai_usage_select_own on public.ai_usage;
drop policy if exists ai_usage_insert_own on public.ai_usage;
drop policy if exists ai_usage_update_own on public.ai_usage;
drop policy if exists ai_usage_delete_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;
