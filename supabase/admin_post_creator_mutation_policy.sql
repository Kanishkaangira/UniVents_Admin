-- Apply after admin_skill_faculty_scope.sql.
-- Creators and Super admins retain post management access. An admin assigned
-- to the target scope may edit a rejected post to return it to Pending.

grant update, delete on public.events to authenticated;

create or replace function public.guard_rejected_target_admin_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  editing_admin public.admins%rowtype;
  is_target_admin boolean := false;
begin
  if old.approval::text <> 'rejected' then
    return new;
  end if;

  select * into editing_admin
  from public.admins
  where id = (select auth.uid());

  if not found
    or editing_admin.scope_type::text = 'super'
    or old.created_by = (select auth.uid()) then
    return new;
  end if;

  is_target_admin :=
    (editing_admin.scope_type::text = 'skill_faculty'
      and old.organizer_scope::text in ('skill_faculty', 'department')
      and old.skill_faculty_id = editing_admin.skill_faculty_id)
    or (editing_admin.scope_type::text = 'department'
      and old.organizer_scope::text = 'department'
      and old.department_id = editing_admin.department_id)
    or (editing_admin.scope_type::text = 'club'
      and old.organizer_scope::text = 'club'
      and old.club_id = editing_admin.club_id);

  if not is_target_admin then
    raise exception 'Only the post creator, its target-scope admin, or a Super admin can edit this rejected post.'
      using errcode = '42501';
  end if;

  if new.created_by is distinct from old.created_by
    or new.creator_scope is distinct from old.creator_scope
    or new.organizer_scope is distinct from old.organizer_scope
    or new.skill_faculty_id is distinct from old.skill_faculty_id
    or new.department_id is distinct from old.department_id
    or new.club_id is distinct from old.club_id then
    raise exception 'Target-scope admins cannot change the author or target of a rejected post.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists events_guard_rejected_target_admin_edit on public.events;
create trigger events_guard_rejected_target_admin_edit
before update on public.events
for each row execute function public.guard_rejected_target_admin_edit();

drop policy if exists events_creator_super_update on public.events;
drop policy if exists events_rejected_target_update on public.events;
create policy events_rejected_target_update on public.events
  for update to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and (
          admin_row.scope_type::text = 'super'
          or (events.approval::text = 'rejected'
            and (
              (admin_row.scope_type::text = 'skill_faculty'
                and events.organizer_scope::text in ('skill_faculty', 'department')
                and events.skill_faculty_id = admin_row.skill_faculty_id)
              or (admin_row.scope_type::text = 'department'
                and events.organizer_scope::text = 'department'
                and events.department_id = admin_row.department_id)
              or (admin_row.scope_type::text = 'club'
                and events.organizer_scope::text = 'club'
                and events.club_id = admin_row.club_id)
            ))
        )
    )
  )
  with check (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and (
          admin_row.scope_type::text = 'super'
          or (events.approval::text = 'pending'
            and (
              (admin_row.scope_type::text = 'skill_faculty'
                and events.organizer_scope::text in ('skill_faculty', 'department')
                and events.skill_faculty_id = admin_row.skill_faculty_id)
              or (admin_row.scope_type::text = 'department'
                and events.organizer_scope::text = 'department'
                and events.department_id = admin_row.department_id)
              or (admin_row.scope_type::text = 'club'
                and events.organizer_scope::text = 'club'
                and events.club_id = admin_row.club_id)
            ))
        )
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
        and (
          admin_row.scope_type::text = 'super'
          or (events.approval::text = 'rejected'
            and (
              (admin_row.scope_type::text = 'skill_faculty'
                and events.organizer_scope::text in ('skill_faculty', 'department')
                and events.skill_faculty_id = admin_row.skill_faculty_id)
              or (admin_row.scope_type::text = 'department'
                and events.organizer_scope::text = 'department'
                and events.department_id = admin_row.department_id)
              or (admin_row.scope_type::text = 'club'
                and events.organizer_scope::text = 'club'
                and events.club_id = admin_row.club_id)
            ))
        )
    )
  )
  with check (
    events.created_by = (select auth.uid())
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and (
          admin_row.scope_type::text = 'super'
          or (events.approval::text = 'pending'
            and (
              (admin_row.scope_type::text = 'skill_faculty'
                and events.organizer_scope::text in ('skill_faculty', 'department')
                and events.skill_faculty_id = admin_row.skill_faculty_id)
              or (admin_row.scope_type::text = 'department'
                and events.organizer_scope::text = 'department'
                and events.department_id = admin_row.department_id)
              or (admin_row.scope_type::text = 'club'
                and events.organizer_scope::text = 'club'
                and events.club_id = admin_row.club_id)
            ))
        )
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
