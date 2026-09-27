-- Admins are Supabase Auth users and may not have a public.profiles row.
-- Point events.created_by at auth.users so admin-created rows pass the FK.
-- Preserve the existing ON DELETE behavior when replacing the old FK.

do $$
declare
  delete_action text := 'NO ACTION';
  delete_code "char";
begin
  select constraint_row.confdeltype
  into delete_code
  from pg_constraint as constraint_row
  where constraint_row.conrelid = 'public.events'::regclass
    and constraint_row.conname = 'events_created_by_fkey'
    and constraint_row.contype = 'f';

  if found then
    delete_action := case delete_code
      when 'a' then 'NO ACTION'
      when 'r' then 'RESTRICT'
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      else 'NO ACTION'
    end;

    alter table public.events drop constraint events_created_by_fkey;
  end if;

  execute format(
    'alter table public.events add constraint events_created_by_fkey foreign key (created_by) references auth.users(id) on delete %s',
    delete_action
  );
end;
$$;

notify pgrst, 'reload schema';
