create extension if not exists "pgcrypto";

create table if not exists public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My CV',
  category_id text not null,
  cv_data jsonb not null default '{}'::jsonb,
  theme_id text not null default 'blue',
  layout_id text not null default 'sidebar',
  profile_photo_path text,
  share_slug text unique,
  is_public boolean not null default false,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cv_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid references public.cvs(id) on delete cascade,
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cvs
add column if not exists expires_at timestamptz not null default (now() + interval '14 days');

create index if not exists cvs_user_expires_at_idx
on public.cvs (user_id, expires_at);

create index if not exists cv_drafts_user_updated_at_idx
on public.cv_drafts (user_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cvs_touch_updated_at on public.cvs;
create trigger cvs_touch_updated_at
before update on public.cvs
for each row execute function public.touch_updated_at();

drop trigger if exists cv_drafts_touch_updated_at on public.cv_drafts;
create trigger cv_drafts_touch_updated_at
before update on public.cv_drafts
for each row execute function public.touch_updated_at();

create or replace function public.delete_expired_cvs()
returns integer
language plpgsql
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.cvs
  where expires_at <= now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

alter table public.cvs enable row level security;
alter table public.cv_drafts enable row level security;

drop policy if exists "Users can manage their cvs" on public.cvs;
create policy "Users can manage their cvs"
on public.cvs for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Public can read shared cvs" on public.cvs;
create policy "Public can read shared cvs"
on public.cvs for select
using (is_public = true and share_slug is not null);

drop policy if exists "Users can manage their cv drafts" on public.cv_drafts;
create policy "Users can manage their cv drafts"
on public.cv_drafts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.cvs to authenticated;
grant select, insert, update, delete on public.cv_drafts to authenticated;

comment on column public.cvs.expires_at is 'Saved CVs are retained online for 14 days so users are encouraged to download their own copies.';
comment on function public.delete_expired_cvs() is 'Deletes CV records after their 14-day online retention period. Schedule daily with Supabase if pg_cron is enabled.';
