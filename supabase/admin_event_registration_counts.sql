-- Return attendee totals to the admin who created each event, without exposing
-- registration records to other admins who can view the post in their scope.

create or replace function public.get_event_registration_counts(p_event_ids uuid[])
returns table (event_id uuid, registration_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event_row.id,
    count(registration.id)::bigint
  from public.events as event_row
  join public.admins as admin_row
    on admin_row.id = (select auth.uid())
    and event_row.created_by = admin_row.id
  left join public.event_registrations as registration
    on registration.event_id = event_row.id
  where event_row.id = any(coalesce(p_event_ids, '{}'::uuid[]))
    and event_row.content_type::text = 'event'
    and event_row.registration_required is true
  group by event_row.id;
$$;

revoke all on function public.get_event_registration_counts(uuid[]) from public, anon;
grant execute on function public.get_event_registration_counts(uuid[]) to authenticated;

notify pgrst, 'reload schema';
