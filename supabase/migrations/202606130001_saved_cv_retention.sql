alter table public.cvs
add column if not exists expires_at timestamptz not null default (now() + interval '15 days');

create index if not exists cvs_user_expires_at_idx
on public.cvs (user_id, expires_at);

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

comment on column public.cvs.expires_at is 'Saved CVs are retained online for 15 days so users are encouraged to download their own copies.';
comment on function public.delete_expired_cvs() is 'Deletes CV records after their 15-day online retention period. Schedule daily with Supabase if pg_cron is enabled.';
