alter table public.cvs
alter column expires_at set default (now() + interval '15 days');

update public.cvs
set expires_at = created_at + interval '15 days'
where expires_at is not null;

comment on column public.cvs.expires_at is 'Saved CVs are retained online for 15 days so users can return, download, or update them before automatic deletion.';

comment on function public.delete_expired_cvs() is 'Deletes CV records after their 15-day online retention period. Schedule daily with Supabase if pg_cron is enabled.';
