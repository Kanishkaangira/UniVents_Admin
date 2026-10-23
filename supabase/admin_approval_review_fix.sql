-- Hotfix for approval decisions and resubmitting edited rejected posts.
-- Run in Supabase SQL Editor after admin_skill_faculty_scope.sql.

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

-- Keep the target-scope review inbox available when this hotfix is applied
-- without rerunning the full approval-routing migration.
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
  order by event_row.created_at asc
$$;

revoke all on function public.get_pending_admin_posts() from public, anon;
grant execute on function public.get_pending_admin_posts() to authenticated;

-- Ensure resubmissions publish their UPDATE to the target admins immediately.
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

notify pgrst, 'reload schema';
