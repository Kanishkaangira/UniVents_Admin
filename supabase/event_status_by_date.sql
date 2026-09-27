-- Keep event status aligned with its calendar date (India time).
-- Future = upcoming, today = live, past = completed. Cancelled stays cancelled.
-- A trigger handles inserts/date edits immediately; pg_cron refreshes at
-- 00:00 Asia/Kolkata so events switch to live/completed without app activity.

create or replace function public.set_event_status_from_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  status_type text;
  status_value public.events.status%type;
  next_status text;
  today_local date := (statement_timestamp() at time zone 'Asia/Kolkata')::date;
begin
  if new.content_type::text <> 'event'
    or new.event_date is null
    or new.status::text = 'cancelled' then
    return new;
  end if;

  next_status := case
    when new.event_date < today_local then 'completed'
    when new.event_date = today_local then 'live'
    else 'upcoming'
  end;

  select pg_catalog.format_type(column_info.atttypid, column_info.atttypmod)
  into status_type
  from pg_catalog.pg_attribute as column_info
  where column_info.attrelid = 'public.events'::regclass
    and column_info.attname = 'status'
    and not column_info.attisdropped;

  execute pg_catalog.format('select $1::%s', status_type)
    into status_value
    using next_status;
  new.status := status_value;
  return new;
end;
$$;

drop trigger if exists events_set_status_from_date on public.events;
create trigger events_set_status_from_date
before insert or update of content_type, event_date, status
on public.events
for each row
execute function public.set_event_status_from_date();

create or replace function public.sync_event_statuses_from_dates()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  status_type text;
  changed_count bigint;
  today_local date := (statement_timestamp() at time zone 'Asia/Kolkata')::date;
begin
  select pg_catalog.format_type(column_info.atttypid, column_info.atttypmod)
  into status_type
  from pg_catalog.pg_attribute as column_info
  where column_info.attrelid = 'public.events'::regclass
    and column_info.attname = 'status'
    and not column_info.attisdropped;

  execute pg_catalog.format(
    'update public.events as event_row
       set status = (case
         when event_row.event_date < $1 then ''completed''
         when event_row.event_date = $1 then ''live''
         else ''upcoming''
       end)::%s
     where event_row.content_type::text = ''event''
       and event_row.event_date is not null
       and event_row.status::text <> ''cancelled''
       and event_row.status::text is distinct from case
         when event_row.event_date < $1 then ''completed''
         when event_row.event_date = $1 then ''live''
         else ''upcoming''
       end',
    status_type
  ) using today_local;

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

revoke all on function public.sync_event_statuses_from_dates() from public, anon, authenticated;

-- Correct existing rows immediately.
select public.sync_event_statuses_from_dates();

-- Schedule at 00:00 India Standard Time (18:30 UTC on the prior date).
-- If pg_cron is not enabled, triggers still keep new/edited events correct.
do $$
declare
  old_job_id bigint;
begin
  if pg_catalog.to_regclass('cron.job') is null then
    raise notice 'pg_cron is not enabled. Enable it in Supabase and rerun this SQL to schedule the daily status refresh.';
    return;
  end if;

  for old_job_id in
    select jobid from cron.job where jobname = 'sync-event-statuses-from-dates'
  loop
    perform cron.unschedule(old_job_id);
  end loop;

  perform cron.schedule(
    'sync-event-statuses-from-dates',
    '30 18 * * *',
    'select public.sync_event_statuses_from_dates();'
  );
end;
$$;

notify pgrst, 'reload schema';
