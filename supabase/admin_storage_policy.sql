-- =====================================================================
-- Let admins (not just faculty in `profiles`) upload posters/attachments.
-- Your existing "faculty upload posters" policy only checks public.profiles,
-- but admins are a separate table, so without this an admin's upload fails RLS.
-- Event posters go in Events Folder/ and notice files go in Notice Folder/.
-- Safe to run more than once.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do update set public = true;

drop policy if exists "admins upload posters" on storage.objects;
create policy "admins upload posters" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-posters'
    and (name like 'Events Folder/%' or name like 'Notice Folder/%')
    and exists (select 1 from public.admins a where a.id = (select auth.uid()))
  );

drop policy if exists "event posters public read" on storage.objects;
create policy "event posters public read" on storage.objects
  for select using (bucket_id = 'event-posters');
