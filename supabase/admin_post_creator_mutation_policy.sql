-- Apply after admin_skill_faculty_scope.sql.
-- Post edits and deletes are limited to their creator and Super admins.

grant update, delete on public.events to authenticated;

drop policy if exists events_creator_super_update on public.events;
create policy events_creator_super_update on public.events
  for update to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  )
  with check (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  );

drop policy if exists events_admin_update_scope_guard on public.events;
create policy events_admin_update_scope_guard on public.events
  as restrictive for update to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  )
  with check (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  );

drop policy if exists events_creator_super_delete on public.events;
create policy events_creator_super_delete on public.events
  for delete to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  );

drop policy if exists events_admin_delete_scope_guard on public.events;
create policy events_admin_delete_scope_guard on public.events
  as restrictive for delete to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  );

notify pgrst, 'reload schema';
