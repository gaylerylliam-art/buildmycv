alter table public.cvs
alter column expires_at set default (now() + interval '14 days');

comment on column public.cvs.expires_at is 'Saved CVs are retained online for 14 days so users are encouraged to download their own copies.';

comment on function public.delete_expired_cvs() is 'Deletes CV records after their 14-day online retention period. Schedule daily with Supabase if pg_cron is enabled.';
