-- Run after skill_faculty_scope_enum_values.sql and
-- skill_faculty_department.sql. This migration updates both admins and events.

-- Admin assignments now distinguish Skill Faculty and child Department scopes.
alter table public.admins add column if not exists skill_faculty_id uuid;
alter table public.admins drop constraint if exists admin_scope_matches_fields;

-- Before migration, admins.department_id pointed at skill_faculty; afterward
-- it points at department. Preserve old faculty admins and remain safe to rerun.
do $$
declare department_fk_target oid;
begin
  select constraint_row.confrelid into department_fk_target
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.admins'::regclass
    and constraint_row.conname = 'admins_department_id_fkey';

  if department_fk_target = 'public.skill_faculty'::regclass then
    update public.admins
    set skill_faculty_id = coalesce(skill_faculty_id, department_id),
        department_id = null,
        scope_type = 'skill_faculty'::public.admin_scope_enum
    where scope_type::text = 'department';
    alter table public.admins drop constraint admins_department_id_fkey;
    alter table public.admins
      add constraint admins_department_id_fkey
      foreign key (department_id) references public.department(id) on delete restrict;
  elsif department_fk_target is null then
    alter table public.admins
      add constraint admins_department_id_fkey
      foreign key (department_id) references public.department(id) on delete restrict;
  elsif department_fk_target = 'public.department'::regclass then
    update public.admins as admin_row
    set skill_faculty_id = department_row.skill_faculty_id
    from public.department as department_row
    where admin_row.department_id = department_row.id
      and admin_row.skill_faculty_id is distinct from department_row.skill_faculty_id;
  else
    raise exception 'admins.department_id references an unexpected table; review before migrating.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.admins'::regclass
      and conname = 'admins_skill_faculty_id_fkey'
  ) then
    alter table public.admins
      add constraint admins_skill_faculty_id_fkey
      foreign key (skill_faculty_id) references public.skill_faculty(id) on delete restrict;
  end if;
end;
$$;

create index if not exists admins_skill_faculty_id_idx
  on public.admins using btree (skill_faculty_id);

create or replace function public.set_admin_skill_faculty()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_faculty_id uuid;
begin
  if new.department_id is not null then
    select department_row.skill_faculty_id
      into parent_faculty_id
    from public.department as department_row
    where department_row.id = new.department_id;

    if parent_faculty_id is null then
      raise exception 'The selected department has no Skill Faculty.' using errcode = '23503';
    end if;
    if new.skill_faculty_id is not null
      and new.skill_faculty_id <> parent_faculty_id then
      raise exception 'The selected department does not belong to the selected Skill Faculty.' using errcode = '23514';
    end if;
    new.skill_faculty_id := parent_faculty_id;
  end if;
  return new;
end;
$$;

drop trigger if exists admins_set_skill_faculty on public.admins;
create trigger admins_set_skill_faculty
before insert or update of department_id, skill_faculty_id
on public.admins
for each row execute function public.set_admin_skill_faculty();

alter table public.admins
  add constraint admin_scope_matches_fields check (
    (scope_type = 'super'::public.admin_scope_enum
      and department_id is null and skill_faculty_id is null and club_id is null)
    or (scope_type = 'skill_faculty'::public.admin_scope_enum
      and skill_faculty_id is not null and department_id is null and club_id is null)
    or (scope_type = 'department'::public.admin_scope_enum
      and department_id is not null and skill_faculty_id is not null and club_id is null)
    or (scope_type = 'club'::public.admin_scope_enum
      and club_id is not null and department_id is null and skill_faculty_id is null)
  );

-- Keep the hierarchy consistent for every department-assigned admin.
alter table public.admins
  drop constraint if exists admins_department_skill_faculty_consistent;
alter table public.admins
  add constraint admins_department_skill_faculty_consistent
  check (department_id is null or skill_faculty_id is not null);

-- Upgrade events created by the previous migration. Legacy faculty-level posts
-- become Skill Faculty posts; child department posts retain both foreign keys.
alter table public.events add column if not exists skill_faculty_id uuid;
alter table public.events drop constraint if exists events_organizer_scope_valid;

do $$
declare
  department_fk_target oid;
begin
  select constraint_row.confrelid
    into department_fk_target
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.events'::regclass
    and constraint_row.conname = 'events_department_id_fkey';

  if department_fk_target = 'public.skill_faculty'::regclass then
    update public.events
    set skill_faculty_id = coalesce(skill_faculty_id, department_id),
        department_id = null
    where department_id is not null;

    alter table public.events drop constraint events_department_id_fkey;
    alter table public.events
      add constraint events_department_id_fkey
      foreign key (department_id) references public.department(id) on delete restrict;
  elsif department_fk_target is null then
    alter table public.events
      add constraint events_department_id_fkey
      foreign key (department_id) references public.department(id) on delete restrict;
  elsif department_fk_target <> 'public.department'::regclass then
    raise exception 'events.department_id references an unexpected table; review before migrating.';
  end if;
end;
$$;

update public.events as event_row
set skill_faculty_id = department_row.skill_faculty_id
from public.department as department_row
where event_row.department_id = department_row.id
  and event_row.skill_faculty_id is distinct from department_row.skill_faculty_id;

create or replace function public.set_event_skill_faculty()
returns trigger
language plpgsql
set search_path = ''
as $$
declare parent_faculty_id uuid;
begin
  if new.department_id is not null then
    select department_row.skill_faculty_id into parent_faculty_id
    from public.department as department_row where department_row.id = new.department_id;
    if parent_faculty_id is null then
      raise exception 'The selected department has no Skill Faculty.' using errcode = '23503';
    end if;
    if new.skill_faculty_id is not null and new.skill_faculty_id <> parent_faculty_id then
      raise exception 'The selected department does not belong to the selected Skill Faculty.' using errcode = '23514';
    end if;
    new.skill_faculty_id := parent_faculty_id;
  end if;
  return new;
end;
$$;
drop trigger if exists events_set_skill_faculty on public.events;
create trigger events_set_skill_faculty
before insert or update of department_id, skill_faculty_id
on public.events for each row execute function public.set_event_skill_faculty();

update public.events
set organizer_scope = 'skill_faculty'::public.organizer_scope_enum
where organizer_scope::text = 'department'
  and department_id is null
  and skill_faculty_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_skill_faculty_id_fkey'
  ) then
    alter table public.events
      add constraint events_skill_faculty_id_fkey
      foreign key (skill_faculty_id) references public.skill_faculty(id) on delete restrict;
  end if;
end;
$$;

create index if not exists events_skill_faculty_id_idx
  on public.events using btree (skill_faculty_id);

alter table public.events
  drop constraint if exists events_creator_scope_check;
alter table public.events
  add constraint events_creator_scope_check check (
    creator_scope is null or creator_scope = any (array['super', 'skill_faculty', 'department', 'club']::text[])
  );

update public.events as event_row
set creator_scope = admin_row.scope_type::text
from public.admins as admin_row
where event_row.created_by = admin_row.id
  and event_row.creator_scope is distinct from admin_row.scope_type::text;

alter table public.events
  add constraint events_organizer_scope_valid check (
    (organizer_scope <> 'university'::public.organizer_scope_enum
      or (skill_faculty_id is null and department_id is null and club_id is null))
    and (organizer_scope <> 'skill_faculty'::public.organizer_scope_enum
      or (skill_faculty_id is not null and department_id is null and club_id is null))
    and (organizer_scope <> 'department'::public.organizer_scope_enum
      or (skill_faculty_id is not null and department_id is not null and club_id is null))
    and (organizer_scope <> 'club'::public.organizer_scope_enum
      or (club_id is not null and skill_faculty_id is null and department_id is null))
  );

-- Refresh current_admin's return shape after adding skill_faculty_id.
alter table public.admins enable row level security;
revoke select on table public.admins from anon, authenticated, public;
grant select (id, email, scope_type, department_id, skill_faculty_id, club_id)
  on table public.admins to authenticated;

drop function if exists public.current_admin();
create function public.current_admin()
returns table (
  id uuid,
  email text,
  scope_type text,
  department_id uuid,
  skill_faculty_id uuid,
  club_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select admin_row.id, admin_row.email, admin_row.scope_type::text,
         admin_row.department_id, admin_row.skill_faculty_id, admin_row.club_id
  from public.admins as admin_row
  where admin_row.id = (select auth.uid())
$$;
revoke all on function public.current_admin() from public, anon;
grant execute on function public.current_admin() to authenticated;

-- Read new hierarchy tables and keep department editing super-admin-only.
alter table public.skill_faculty enable row level security;
alter table public.department enable row level security;
grant select on public.skill_faculty, public.department to authenticated;
drop policy if exists skill_faculty_authenticated_read on public.skill_faculty;
create policy skill_faculty_authenticated_read on public.skill_faculty
  for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists department_authenticated_read on public.department;
create policy department_authenticated_read on public.department
  for select to authenticated using ((select auth.uid()) is not null);
grant insert, update, delete on public.department to authenticated;
drop policy if exists department_super_insert on public.department;
create policy department_super_insert on public.department
  for insert to authenticated with check (exists (
    select 1 from public.admins as admin_row
    where admin_row.id = (select auth.uid()) and admin_row.scope_type::text = 'super'
  ));
drop policy if exists department_super_update on public.department;
create policy department_super_update on public.department
  for update to authenticated using (exists (
    select 1 from public.admins as admin_row
    where admin_row.id = (select auth.uid()) and admin_row.scope_type::text = 'super'
  )) with check (exists (
    select 1 from public.admins as admin_row
    where admin_row.id = (select auth.uid()) and admin_row.scope_type::text = 'super'
  ));
drop policy if exists department_super_delete on public.department;
create policy department_super_delete on public.department
  for delete to authenticated using (exists (
    select 1 from public.admins as admin_row
    where admin_row.id = (select auth.uid()) and admin_row.scope_type::text = 'super'
  ));

-- Posts in the creator's own scope are approved automatically. Posts sent to
-- another scope wait for approval from the target organization's admins.
create or replace function public.compute_event_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_admin public.admins%rowtype;
  target_skill_faculty_id uuid;
  is_own_scope boolean := false;
begin
  select * into creator_admin from public.admins where id = new.created_by;
  if not found then
    raise exception 'The post creator must be a registered admin.' using errcode = '42501';
  end if;
  if new.department_id is not null then
    select department_row.skill_faculty_id
      into target_skill_faculty_id
    from public.department as department_row
    where department_row.id = new.department_id;
    if target_skill_faculty_id is null then
      raise exception 'The selected department has no Skill Faculty.' using errcode = '23503';
    end if;
    if new.skill_faculty_id is not null
      and new.skill_faculty_id <> target_skill_faculty_id then
      raise exception 'The selected department does not belong to the selected Skill Faculty.' using errcode = '23514';
    end if;
    new.skill_faculty_id := target_skill_faculty_id;
  end if;
  new.creator_scope := creator_admin.scope_type::text;
  if creator_admin.scope_type::text = 'super' then
    new.approval := 'approved';
  else
    is_own_scope :=
      (creator_admin.scope_type::text = 'skill_faculty'
        and new.skill_faculty_id = creator_admin.skill_faculty_id
        and new.organizer_scope::text = 'skill_faculty')
      or (creator_admin.scope_type::text = 'department'
        and new.organizer_scope::text = 'department'
        and new.department_id = creator_admin.department_id)
      or (creator_admin.scope_type::text = 'club'
        and new.organizer_scope::text = 'club'
        and new.club_id = creator_admin.club_id);
    new.approval := case when is_own_scope
      then 'approved'::public.approval_status_enum
      else 'pending'::public.approval_status_enum
    end;
  end if;
  return new;
end;
$$;

create or replace function public.get_pending_admin_posts()
returns setof public.events
language sql
stable
security definer
set search_path = ''
as $$
  select event_row.*
  from public.events as event_row
  join public.admins as admin_row on admin_row.id = (select auth.uid())
  where event_row.approval::text = 'pending'
    and (
      (admin_row.scope_type::text = 'super')
      or (event_row.organizer_scope::text = 'skill_faculty'
        and admin_row.scope_type::text = 'skill_faculty'
        and event_row.skill_faculty_id = admin_row.skill_faculty_id)
      or (event_row.organizer_scope::text = 'department'
        and admin_row.scope_type::text = 'skill_faculty'
        and event_row.skill_faculty_id = admin_row.skill_faculty_id)
      or (event_row.organizer_scope::text = 'department'
        and admin_row.scope_type::text = 'department'
        and event_row.department_id = admin_row.department_id)
      or (event_row.organizer_scope::text = 'club'
        and admin_row.scope_type::text = 'club'
        and event_row.club_id = admin_row.club_id)
    )
  order by event_row.created_at asc
$$;
revoke all on function public.get_pending_admin_posts() from public, anon;
grant execute on function public.get_pending_admin_posts() to authenticated;

create or replace function public.protect_approval_column()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare reviewing_admin public.admins%rowtype;
begin
  if new.approval::text is not distinct from old.approval::text then return new; end if;
  if old.approval::text <> 'pending' or new.approval::text not in ('approved', 'rejected') then
    raise exception 'Only pending posts can be approved or rejected.' using errcode = '42501';
  end if;
  select * into reviewing_admin from public.admins where id = (select auth.uid());
  if not found then
    raise exception 'Only an admin assigned to this post scope can review it.' using errcode = '42501';
  end if;
  if reviewing_admin.scope_type::text = 'super'
    or (reviewing_admin.scope_type::text = 'skill_faculty'
      and old.organizer_scope::text in ('skill_faculty', 'department')
      and old.skill_faculty_id = reviewing_admin.skill_faculty_id)
    or (reviewing_admin.scope_type::text = 'department'
      and old.organizer_scope::text = 'department'
      and old.department_id = reviewing_admin.department_id)
    or (reviewing_admin.scope_type::text = 'club'
      and old.organizer_scope::text = 'club'
      and old.club_id = reviewing_admin.club_id) then
    return new;
  end if;
  raise exception 'You are not assigned to review this post.' using errcode = '42501';
end;
$$;

create or replace function public.review_event_approval(p_event_id uuid, p_decision text)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare result_row public.events%rowtype; affected_count bigint;
begin
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;
  update public.events as event_row
  set approval = p_decision::public.approval_status_enum
  where event_row.id = p_event_id
    and event_row.approval::text = 'pending'
    and exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and (
          admin_row.scope_type::text = 'super'
          or (admin_row.scope_type::text = 'skill_faculty'
            and event_row.organizer_scope::text in ('skill_faculty', 'department')
            and event_row.skill_faculty_id = admin_row.skill_faculty_id)
          or (admin_row.scope_type::text = 'department'
            and event_row.organizer_scope::text = 'department'
            and event_row.department_id = admin_row.department_id)
          or (admin_row.scope_type::text = 'club'
            and event_row.organizer_scope::text = 'club'
            and event_row.club_id = admin_row.club_id)
        )
    )
  returning event_row.* into result_row;
  get diagnostics affected_count = row_count;
  if affected_count = 0 then
    raise exception 'This pending post is not assigned to your admin scope.' using errcode = '42501';
  end if;
  return result_row;
end;
$$;
revoke all on function public.review_event_approval(uuid, text) from public, anon;
grant execute on function public.review_event_approval(uuid, text) to authenticated;

-- Editing a rejected post resubmits it to the same target scope for review.
create or replace function public.resubmit_rejected_event_on_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approval::text = 'rejected'
    and new.approval::text = 'rejected' then
    new.approval := 'pending'::public.approval_status_enum;
  end if;
  return new;
end;
$$;
drop trigger if exists events_resubmit_rejected_on_edit on public.events;
create trigger events_resubmit_rejected_on_edit
before update on public.events
for each row execute function public.resubmit_rejected_event_on_edit();

-- Ensure inserts and approval decisions use these current functions after a
-- rerun, replacing triggers left behind by earlier approval migrations.
alter table public.events alter column approval set default 'pending';
do $$
declare trigger_name text;
begin
  for trigger_name in
    select trigger_row.tgname
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.events'::regclass
      and trigger_row.tgfoid = 'public.compute_event_approval()'::regprocedure
      and not trigger_row.tgisinternal
  loop
    execute pg_catalog.format('drop trigger %I on public.events', trigger_name);
  end loop;
end;
$$;
create trigger events_compute_event_approval
before insert on public.events
for each row execute function public.compute_event_approval();

do $$
declare trigger_name text;
begin
  for trigger_name in
    select trigger_row.tgname
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.events'::regclass
      and trigger_row.tgfoid = 'public.protect_approval_column()'::regprocedure
      and not trigger_row.tgisinternal
  loop
    execute pg_catalog.format('drop trigger %I on public.events', trigger_name);
  end loop;
end;
$$;
create trigger events_protect_approval_column
before update of approval on public.events
for each row execute function public.protect_approval_column();

-- Any registered admin may submit to any target scope. The approval trigger
-- decides whether the row is approved immediately or waits for that target.
grant insert on public.events to authenticated;
drop policy if exists "admins create posts as themselves" on public.events;
create policy "admins create posts as themselves" on public.events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.admins as admin_row
      where admin_row.id = (select auth.uid())
    )
  );

-- Publish event inserts to Realtime so target admins get approval alerts
-- immediately. Polling in the admin UI remains as a reconnect fallback.
do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end;
$$;

drop policy if exists events_pending_creator_reviewer_guard on public.events;
create policy events_pending_creator_reviewer_guard
  on public.events as restrictive for select to authenticated
  using (
    events.approval::text = 'approved'
    or exists (
      select 1 from public.admins as admin_row
      where admin_row.id = (select auth.uid())
    )
  );

-- Only the post creator and Super admins may edit or delete a post.
grant update, delete on public.events to authenticated;

drop policy if exists events_creator_super_update on public.events;
create policy events_creator_super_update on public.events
  for update to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1 from public.admins as admin_row
      where admin_row.id = (select auth.uid()) and admin_row.scope_type::text = 'super'
    )
  )
  with check (
    events.created_by = (select auth.uid())
    or exists (
      select 1 from public.admins as admin_row
      where admin_row.id = (select auth.uid()) and admin_row.scope_type::text = 'super'
    )
  );

drop policy if exists events_admin_update_scope_guard on public.events;
create policy events_admin_update_scope_guard on public.events
  as restrictive for update to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1 from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  )
  with check (
    events.created_by = (select auth.uid())
    or exists (
      select 1 from public.admins as admin_row
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
      select 1 from public.admins as admin_row
      where admin_row.id = (select auth.uid()) and admin_row.scope_type::text = 'super'
    )
  );

drop policy if exists events_admin_delete_scope_guard on public.events;
create policy events_admin_delete_scope_guard on public.events
  as restrictive for delete to authenticated
  using (
    events.created_by = (select auth.uid())
    or exists (
      select 1 from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and admin_row.scope_type::text = 'super'
    )
  );

notify pgrst, 'reload schema';
