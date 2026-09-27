-- Restrict admin and organization management to super admins.
-- Run after admin_auth_policy.sql creates public.current_admin().

create or replace function public.current_admin_is_super()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins as admin_row
    where admin_row.id = (select auth.uid())
      and admin_row.scope_type::text = 'super'
  )
$$;

revoke all on function public.current_admin_is_super() from public, anon;
grant execute on function public.current_admin_is_super() to authenticated;

alter table public.admins enable row level security;
alter table public.departments enable row level security;
alter table public.clubs enable row level security;

grant select, insert, update, delete on public.admins to authenticated;
grant select on public.departments to authenticated;
grant select on public.clubs to authenticated;
grant insert, update, delete on public.departments to authenticated;
grant insert, update, delete on public.clubs to authenticated;

drop policy if exists departments_authenticated_read on public.departments;
create policy departments_authenticated_read on public.departments
  for select to authenticated
  using ((select auth.uid()) is not null);
drop policy if exists clubs_authenticated_read on public.clubs;
create policy clubs_authenticated_read on public.clubs
  for select to authenticated
  using ((select auth.uid()) is not null);

-- Super admins can list all admins; other admins retain their own-row policy.
drop policy if exists admins_super_select on public.admins;
create policy admins_super_select on public.admins
  for select to authenticated
  using ((select public.current_admin_is_super()));

-- Permissive policies grant super-admin writes; restrictive guards prevent an
-- older broad policy from accidentally granting these writes to other roles.
drop policy if exists admins_super_insert on public.admins;
create policy admins_super_insert on public.admins
  for insert to authenticated
  with check ((select public.current_admin_is_super()));
drop policy if exists admins_super_insert_guard on public.admins;
create policy admins_super_insert_guard on public.admins
  as restrictive for insert to authenticated
  with check ((select public.current_admin_is_super()));

drop policy if exists admins_super_update on public.admins;
create policy admins_super_update on public.admins
  for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));
drop policy if exists admins_super_update_guard on public.admins;
create policy admins_super_update_guard on public.admins
  as restrictive for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));

drop policy if exists admins_super_delete on public.admins;
create policy admins_super_delete on public.admins
  for delete to authenticated
  using ((select public.current_admin_is_super()));
drop policy if exists admins_super_delete_guard on public.admins;
create policy admins_super_delete_guard on public.admins
  as restrictive for delete to authenticated
  using ((select public.current_admin_is_super()));

-- Departments and clubs remain readable according to existing policies; only
-- a super admin can mutate their rows.
drop policy if exists departments_super_insert on public.departments;
create policy departments_super_insert on public.departments
  for insert to authenticated
  with check ((select public.current_admin_is_super()));
drop policy if exists departments_super_insert_guard on public.departments;
create policy departments_super_insert_guard on public.departments
  as restrictive for insert to authenticated
  with check ((select public.current_admin_is_super()));
drop policy if exists departments_super_update on public.departments;
create policy departments_super_update on public.departments
  for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));
drop policy if exists departments_super_update_guard on public.departments;
create policy departments_super_update_guard on public.departments
  as restrictive for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));
drop policy if exists departments_super_delete on public.departments;
create policy departments_super_delete on public.departments
  for delete to authenticated
  using ((select public.current_admin_is_super()));
drop policy if exists departments_super_delete_guard on public.departments;
create policy departments_super_delete_guard on public.departments
  as restrictive for delete to authenticated
  using ((select public.current_admin_is_super()));

drop policy if exists clubs_super_insert on public.clubs;
create policy clubs_super_insert on public.clubs
  for insert to authenticated
  with check ((select public.current_admin_is_super()));
drop policy if exists clubs_super_insert_guard on public.clubs;
create policy clubs_super_insert_guard on public.clubs
  as restrictive for insert to authenticated
  with check ((select public.current_admin_is_super()));
drop policy if exists clubs_super_update on public.clubs;
create policy clubs_super_update on public.clubs
  for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));
drop policy if exists clubs_super_update_guard on public.clubs;
create policy clubs_super_update_guard on public.clubs
  as restrictive for update to authenticated
  using ((select public.current_admin_is_super()))
  with check ((select public.current_admin_is_super()));
drop policy if exists clubs_super_delete on public.clubs;
create policy clubs_super_delete on public.clubs
  for delete to authenticated
  using ((select public.current_admin_is_super()));
drop policy if exists clubs_super_delete_guard on public.clubs;
create policy clubs_super_delete_guard on public.clubs
  as restrictive for delete to authenticated
  using ((select public.current_admin_is_super()));
