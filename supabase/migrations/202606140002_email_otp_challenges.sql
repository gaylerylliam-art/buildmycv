create table if not exists public.email_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null default 'signup',
  otp_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_otp_challenges_lookup_idx
  on public.email_otp_challenges (email, purpose, created_at desc)
  where consumed_at is null;

create index if not exists email_otp_challenges_expiry_idx
  on public.email_otp_challenges (expires_at);

alter table public.email_otp_challenges enable row level security;
