-- Store the creator's admin level separately from the level/organization
-- selected for the post. `organizer_scope` is user-selectable; `creator_scope`
-- is always derived from public.admins and must never come from the client.

alter table public.events
  add column if not exists creator_scope text;

update public.events as event_row
set creator_scope = admin_row.scope_type::text
from public.admins as admin_row
where admin_row.id = event_row.created_by
  and event_row.creator_scope is distinct from admin_row.scope_type::text;

update public.events
set creator_scope = null
where creator_scope is not null
  and creator_scope not in ('super', 'department', 'club');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_creator_scope_check'
  ) then
    alter table public.events
      add constraint events_creator_scope_check
      check (creator_scope is null or creator_scope in ('super', 'department', 'club'));
  end if;
end;
$$;

-- Pending is the safe default. The trigger approves posts that match their
-- creator's own scope and leaves cross-scope submissions pending.
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
  if new.created_by is null then
    raise exception 'A post must have a creator.' using errcode = '23502';
  end if;

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

-- Replace any earlier trigger attached to this function with one canonical
-- BEFORE INSERT trigger so approval is decided by the database.
do $$
declare
  existing_trigger text;
begin
  for existing_trigger in
    select trigger_row.tgname
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.events'::regclass
      and trigger_row.tgfoid = 'public.compute_event_approval()'::regprocedure
      and not trigger_row.tgisinternal
  loop
    execute pg_catalog.format('drop trigger %I on public.events', existing_trigger);
  end loop;
end;
$$;

create trigger events_compute_event_approval
before insert on public.events
for each row
execute function public.compute_event_approval();

notify pgrst, 'reload schema';
