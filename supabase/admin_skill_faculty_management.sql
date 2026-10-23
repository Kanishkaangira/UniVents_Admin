-- Allow only Super admins to manage Skill Faculty records.
-- Run after admin_management_policy.sql.

grant insert, update, delete on public.skill_faculty to authenticated;

drop policy if exists skill_faculty_super_insert on public.skill_faculty;
create policy skill_faculty_super_insert on public.skill_faculty
  for insert to authenticated
  with check ((select public.current_admin_is_super()));
drop policy if exists skill_faculty_super_insert_guard on public.skill_faculty;
create policy skill_faculty_super_insert_guard on public.skill_faculty
  as restrictive for insert to authenticated
  with check ((select public.current_admin_is_super()));

drop policy if exists skill_faculty_super_update on public.skill_faculty;
create policy skill_faculty_super_update on public.skill_faculty
  for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));
drop policy if exists skill_faculty_super_update_guard on public.skill_faculty;
create policy skill_faculty_super_update_guard on public.skill_faculty
  as restrictive for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));

drop policy if exists skill_faculty_super_delete on public.skill_faculty;
create policy skill_faculty_super_delete on public.skill_faculty
  for delete to authenticated
  using ((select public.current_admin_is_super()));
drop policy if exists skill_faculty_super_delete_guard on public.skill_faculty;
create policy skill_faculty_super_delete_guard on public.skill_faculty
  as restrictive for delete to authenticated
  using ((select public.current_admin_is_super()));
