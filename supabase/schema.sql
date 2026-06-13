create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  country text,
  phone text,
  preferred_language text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.cv_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid not null references public.cvs(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_id uuid references public.cvs(id) on delete set null,
  title text not null default 'My Cover Letter',
  role text not null,
  letter_data jsonb not null default '{}'::jsonb,
  theme_id text not null default 'blue',
  font_id text not null default 'sans',
  layout_id text not null default 'classic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cv_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cv_data jsonb not null default '{}'::jsonb,
  template_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.download_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  cv_id uuid references public.cvs(id) on delete set null,
  document_type text not null check (document_type in ('cv_pdf', 'cv_word', 'cover_letter_pdf', 'cover_letter_word')),
  contact_name text,
  contact_email text,
  contact_country text,
  contact_number text,
  otp_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cvs_user_expires_at_idx
on public.cvs (user_id, expires_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists cvs_touch_updated_at on public.cvs;
create trigger cvs_touch_updated_at
before update on public.cvs
for each row execute function public.touch_updated_at();

drop trigger if exists cv_drafts_touch_updated_at on public.cv_drafts;
create trigger cv_drafts_touch_updated_at
before update on public.cv_drafts
for each row execute function public.touch_updated_at();

drop trigger if exists cover_letters_touch_updated_at on public.cover_letters;
create trigger cover_letters_touch_updated_at
before update on public.cover_letters
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.cvs enable row level security;
alter table public.cv_drafts enable row level security;
alter table public.cv_history enable row level security;
alter table public.cover_letters enable row level security;
alter table public.contact_messages enable row level security;
alter table public.cv_saves enable row level security;
alter table public.analytics_events enable row level security;
alter table public.download_requests enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
on public.profiles for insert
with check (auth.uid() = id);

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

drop policy if exists "Users can read their cv history" on public.cv_history;
create policy "Users can read their cv history"
on public.cv_history for select
using (auth.uid() = user_id);

drop policy if exists "Users can add their cv history" on public.cv_history;
create policy "Users can add their cv history"
on public.cv_history for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can manage their cover letters" on public.cover_letters;
create policy "Users can manage their cover letters"
on public.cover_letters for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Anyone can submit contact messages" on public.contact_messages;
create policy "Anyone can submit contact messages"
on public.contact_messages for insert
with check (true);

drop policy if exists "Users can manage their cv saves" on public.cv_saves;
create policy "Users can manage their cv saves"
on public.cv_saves for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can add analytics events" on public.analytics_events;
create policy "Users can add analytics events"
on public.analytics_events for insert
with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can read their analytics events" on public.analytics_events;
create policy "Users can read their analytics events"
on public.analytics_events for select
using (auth.uid() = user_id);

drop policy if exists "Users can add download requests" on public.download_requests;
create policy "Users can add download requests"
on public.download_requests for insert
with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users can read their download requests" on public.download_requests;
create policy "Users can read their download requests"
on public.download_requests for select
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

drop policy if exists "Users can read own profile photos" on storage.objects;
create policy "Users can read own profile photos"
on storage.objects for select
using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can upload own profile photos" on storage.objects;
create policy "Users can upload own profile photos"
on storage.objects for insert
with check (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update own profile photos" on storage.objects;
create policy "Users can update own profile photos"
on storage.objects for update
using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own profile photos" on storage.objects;
create policy "Users can delete own profile photos"
on storage.objects for delete
using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

grant insert on public.contact_messages to anon, authenticated;
grant select, insert, update, delete on public.cv_saves to authenticated;
