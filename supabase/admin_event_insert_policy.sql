-- Allow signed-in admins to create posts as themselves.
-- The compute_event_approval trigger assigns approved/pending based on the
-- creator's public.admins scope and the post's organizer_scope.
-- Run admin_events_created_by_auth_fk.sql first so admin UUIDs need not exist
-- in public.profiles.

alter table public.events enable row level security;

grant insert on public.events to authenticated;

drop policy if exists "admins create posts as themselves" on public.events;
create policy "admins create posts as themselves" on public.events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
