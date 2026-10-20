-- Apply after admin_skill_faculty_scope.sql.
-- Every registered admin can view all event and notice posts. App users can
-- view approved posts only. Update and delete remain creator/Super-only.

drop policy if exists events_pending_creator_reviewer_guard on public.events;
create policy events_pending_creator_reviewer_guard
  on public.events as restrictive for select to authenticated
  using (
    approval::text = 'approved'
    or exists (
      select 1
      from public.admins as admin_row
      where admin_row.id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
