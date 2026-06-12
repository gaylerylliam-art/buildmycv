create table if not exists public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text,
  role_interest text,
  created_at timestamptz default now(),
  confirmed boolean default false,
  unsubscribed boolean default false
);

alter table public.email_subscribers enable row level security;

drop policy if exists "No public email subscriber reads" on public.email_subscribers;
drop policy if exists "No public email subscriber writes" on public.email_subscribers;
