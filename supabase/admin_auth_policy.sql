-- Link each admin row to the matching Supabase Auth user by UUID.
-- Passwords are verified by Supabase Auth and must not be stored in public.admins.

alter table public.admins enable row level security;

revoke select on table public.admins from anon, authenticated, public;
grant select (id, email, scope_type, department_id, club_id)
  on table public.admins to authenticated;

drop policy if exists "admins can read own row" on public.admins;
create policy "admins can read own row" on public.admins
  for select to authenticated
  using ((select auth.uid()) = id);

-- Return only the signed-in admin's identity and scope to the web panel.
-- SECURITY DEFINER lets the function read the protected admins table while
-- auth.uid() still ensures callers cannot request another admin's row.
-- PostgreSQL cannot replace a table-returning function when its OUT row type
-- changes. Drop the prior no-argument version before creating this definition.
drop function if exists public.current_admin();

create or replace function public.current_admin()
returns table (
  id uuid,
  email text,
  scope_type text,
  department_id uuid,
  club_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    admin_row.id,
    admin_row.email,
    admin_row.scope_type::text,
    admin_row.department_id,
    admin_row.club_id
  from public.admins as admin_row
  where admin_row.id = (select auth.uid())
$$;

revoke all on function public.current_admin() from public, anon;
grant execute on function public.current_admin() to authenticated;
