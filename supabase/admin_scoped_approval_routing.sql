-- Route pending posts to the admin assigned to the selected target scope:
-- university -> super admins, department -> admins for that department,
-- club -> admins for that club. Supports department/club cross-post requests.

alter table public.events add column if not exists creator_scope text;
alter table public.events alter column approval set default 'pending';

create or replace function public.compute_event_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator_admin public.admins%rowtype;
begin
  select * into creator_admin
  from public.admins
  where id = new.created_by;

  if not found then
    raise exception 'The post creator must be a registered admin.' using errcode = '42501';
  end if;

  new.creator_scope := creator_admin.scope_type::text;

  if creator_admin.scope_type::text = 'super'
    or (creator_admin.scope_type::text = 'department'
      and new.organizer_scope::text = 'department'
      and new.department_id = creator_admin.department_id)
    or (creator_admin.scope_type::text = 'club'
      and new.organizer_scope::text = 'club'
      and new.club_id = creator_admin.club_id) then
    new.approval := 'approved';
  else
    new.approval := 'pending';
  end if;

  return new;
end;
$$;

-- Replace triggers that stamp creator/approval on insert with one canonical trigger.
do $$
declare
  trigger_name text;
begin
  for trigger_name in
    select t.tgname
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.events'::regclass
      and t.tgfoid = 'public.compute_event_approval()'::regprocedure
      and not t.tgisinternal
  loop
    execute pg_catalog.format('drop trigger %I on public.events', trigger_name);
  end loop;
end;
$$;

create trigger events_compute_event_approval
before insert on public.events
for each row execute function public.compute_event_approval();

-- Fetch only pending posts routed to this admin's exact target scope.
-- University posts go to super admins; department/club posts go only to
-- admins assigned to the selected department/club.
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
      (event_row.organizer_scope::text = 'university'
        and admin_row.scope_type::text = 'super')
      or (event_row.organizer_scope::text = 'department'
        and admin_row.scope_type::text = 'department'
        and event_row.department_id = admin_row.department_id)
      or (event_row.organizer_scope::text = 'club'
        and admin_row.scope_type::text = 'club'
        and event_row.club_id = admin_row.club_id)
    )
  order by event_row.created_at asc;
$$;

revoke all on function public.get_pending_admin_posts() from public, anon;
grant execute on function public.get_pending_admin_posts() to authenticated;

-- Protect approval updates even if another client tries to edit events directly.
create or replace function public.protect_approval_column()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reviewing_admin public.admins%rowtype;
begin
  if new.approval::text is not distinct from old.approval::text then
    return new;
  end if;

  if old.approval::text is distinct from 'pending'
    or new.approval::text not in ('approved', 'rejected') then
    raise exception 'Only pending posts can be approved or rejected.' using errcode = '42501';
  end if;

  select * into reviewing_admin
  from public.admins
  where id = (select auth.uid());

  if not found then
    raise exception 'Only an admin assigned to this post scope can review it.' using errcode = '42501';
  end if;

  if (reviewing_admin.scope_type::text = 'super'
      and old.organizer_scope::text = 'university')
    or (old.organizer_scope::text = 'department'
      and reviewing_admin.scope_type::text = 'department'
      and old.department_id = reviewing_admin.department_id)
    or (old.organizer_scope::text = 'club'
      and reviewing_admin.scope_type::text = 'club'
      and old.club_id = reviewing_admin.club_id) then
    return new;
  end if;

  raise exception 'You are not assigned to review this post.' using errcode = '42501';
end;
$$;

do $$
declare
  trigger_name text;
begin
  for trigger_name in
    select t.tgname
    from pg_catalog.pg_trigger as t
    where t.tgrelid = 'public.events'::regclass
      and t.tgfoid = 'public.protect_approval_column()'::regprocedure
      and not t.tgisinternal
  loop
    execute pg_catalog.format('drop trigger %I on public.events', trigger_name);
  end loop;
end;
$$;

create trigger events_protect_approval_column
before update of approval on public.events
for each row execute function public.protect_approval_column();

-- Review through a narrow RPC; callers cannot select arbitrary posts/decisions.
create or replace function public.review_event_approval(p_event_id uuid, p_decision text)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_row public.events%rowtype;
  affected_count bigint;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;

  execute pg_catalog.format(
    'update public.events
       set approval = %L
     where id = $1
       and approval::text = ''pending''
       and (
         exists (
           select 1 from public.admins as admin_row
           where admin_row.id = (select auth.uid())
             and admin_row.scope_type::text = ''super''
             and organizer_scope::text = ''university''
         )
         or exists (
           select 1 from public.admins as admin_row
           where admin_row.id = (select auth.uid())
             and admin_row.scope_type::text = ''department''
             and organizer_scope::text = ''department''
             and department_id = admin_row.department_id
         )
         or exists (
           select 1 from public.admins as admin_row
           where admin_row.id = (select auth.uid())
             and admin_row.scope_type::text = ''club''
             and organizer_scope::text = ''club''
             and club_id = admin_row.club_id
         )
       )
     returning *',
    p_decision
  ) into result_row using p_event_id;

  -- EXECUTE does not update PL/pgSQL's FOUND variable. Read ROW_COUNT so a
  -- successful UPDATE isn't rolled back as if the reviewer lacked access.
  get diagnostics affected_count = row_count;
  if affected_count = 0 then
    raise exception 'This pending post is not assigned to your admin scope.' using errcode = '42501';
  end if;

  return result_row;
end;
$$;

revoke all on function public.review_event_approval(uuid, text) from public, anon;
grant execute on function public.review_event_approval(uuid, text) to authenticated;

notify pgrst, 'reload schema';

-- Approved posts remain visible under the existing event SELECT policies.
-- Pending posts are additionally visible only to their creator and the admins
-- assigned to the selected review destination. Rejected posts stay with their
-- creator, so they can still see the decision in My posts.
alter table public.events enable row level security;

drop policy if exists events_approved_only_anon_guard on public.events;
create policy events_approved_only_anon_guard
  on public.events
  as restrictive
  for select
  to anon
  using (approval::text = 'approved');

drop policy if exists events_pending_creator_reviewer_guard on public.events;
create policy events_pending_creator_reviewer_guard
  on public.events
  as restrictive
  for select
  to authenticated
  using (
    approval::text = 'approved'
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
        and (
          events.created_by = admin_row.id
          or (approval::text = 'pending' and (
            (organizer_scope::text = 'university'
              and admin_row.scope_type::text = 'super')
            or (organizer_scope::text = 'department'
              and admin_row.scope_type::text = 'department'
              and department_id = admin_row.department_id)
            or (organizer_scope::text = 'club'
              and admin_row.scope_type::text = 'club'
              and club_id = admin_row.club_id)
          ))
        )
    )
  );

notify pgrst, 'reload schema';
