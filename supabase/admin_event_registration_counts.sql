-- Return attendee totals to admins without exposing registration records.
-- Counts are limited to events the caller owns or can manage within their scope.

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
  left join public.event_registrations as registration
    on registration.event_id = event_row.id
  where event_row.id = any(coalesce(p_event_ids, '{}'::uuid[]))
    and event_row.content_type::text = 'event'
    and event_row.registration_required is true
    and (
      admin_row.scope_type::text = 'super'
      or event_row.created_by = admin_row.id
      or (admin_row.scope_type::text = 'department'
        and event_row.organizer_scope::text = 'department'
        and event_row.department_id = admin_row.department_id)
      or (admin_row.scope_type::text = 'club'
        and event_row.organizer_scope::text = 'club'
        and event_row.club_id = admin_row.club_id)
    )
  group by event_row.id;
$$;

revoke all on function public.get_event_registration_counts(uuid[]) from public, anon;
grant execute on function public.get_event_registration_counts(uuid[]) to authenticated;

notify pgrst, 'reload schema';
