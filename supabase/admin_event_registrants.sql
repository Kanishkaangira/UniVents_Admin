-- Return a limited attendee snapshot only to the admin who created the event.
-- Other admins may see the scoped post, but registrations remain inaccessible.

create or replace function public.get_event_registrants(p_event_id uuid)
returns table (
  registration_id uuid,
  user_name text,
  email text,
  user_type text,
  department_name text,
  department_code text,
  course text,
  batch text,
  semester integer,
  registered_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.events as event_row
    join public.admins as admin_row on admin_row.id = (select auth.uid())
    where event_row.id = p_event_id
      and event_row.content_type::text = 'event'
      and event_row.registration_required is true
      and event_row.approval::text = 'approved'
      and (
        event_row.created_by = admin_row.id
      )
  ) then
    raise exception 'This event is not available to your admin scope.' using errcode = '42501';
  end if;

  return query
    select
      registration.id,
      registration.user_name,
      registration.email,
      registration.user_type,
      registration.department_name,
      registration.department_code,
      registration.course,
      registration.batch,
      registration.semester,
      registration.created_at
    from public.event_registrations as registration
    where registration.event_id = p_event_id
    order by registration.created_at desc, registration.user_name asc;
end;
$$;

revoke all on function public.get_event_registrants(uuid) from public, anon;
grant execute on function public.get_event_registrants(uuid) to authenticated;

notify pgrst, 'reload schema';
