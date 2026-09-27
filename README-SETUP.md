# UniVents Admin — setup

1. `npm install @supabase/supabase-js react-router-dom`
2. `npm install -D tailwindcss postcss autoprefixer` then `npx tailwindcss init -p`
   (skip the init if tailwind.config.js / postcss.config.js already exist — just
   overwrite them with the ones in this zip)
3. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key
   (same values as the mobile app's `src/Constants/env.js`)
4. Run `supabase/admin_auth_policy.sql` in the Supabase SQL Editor. Each row in
   `public.admins` must use the corresponding Supabase Auth user's UUID as `id`.
   Admin passwords are managed by Supabase Auth, not stored in `public.admins`.
5. Run `supabase/admin_management_policy.sql` after `admin_auth_policy.sql`.
   It grants admin/organization writes only to authenticated super admins.
6. Run `supabase/admin_events_created_by_auth_fk.sql` so `events.created_by`
   references `auth.users` and accepts admins without a `profiles` row.
7. Run `supabase/admin_event_insert_policy.sql` to let admins create event and
   notice rows with `created_by` set to their own Auth UUID.
8. Run `supabase/admin_storage_policy.sql`. It creates/configures the public
   `event-posters` bucket and lets admins upload to `Events Folder/` and
   `Notice Folder/`.
9. Run `supabase/creator_scope_approval.sql` to restore `creator_scope`, derive
   it from the signed-in creator's admin row, and queue cross-scope posts for
   super-admin approval.
10. Run `supabase/admin_event_registration_counts.sql` to show registration
    totals on event cards without exposing attendee details.
11. Run `supabase/event_status_by_date.sql` to set event status from its date
    and schedule the daily refresh (requires `pg_cron` for automatic midnight updates).
12. `npm run dev`

The admin page can promote an existing Auth user by UUID; it does not create
Auth users or store passwords.

## Assumptions this code makes about your schema
- `public.admins` has `id`, `email`, `scope_type`, `department_id`, and `club_id`;
   `id` is the matching `auth.users.id` UUID. Login credentials are checked by
   Supabase Auth, then `current_admin()` returns only the signed-in user's row.
- `events` has: content_type, title, description, category, organizer_name,
  department_id, club_id, event_date, start_time, end_time, venue,
  registration_required, registration_deadline, capacity, image_url,
  visibility, status, attachment_url, attachment_type, attachment_name,
  organizer_scope, creator_scope, approval, created_by.
- `created_by` identifies the author. The author's admin scope is read from
  `public.admins.scope_type`; it is not duplicated on each event row.
- RLS already enforces who can insert/update/delete which rows — this app
  does not duplicate that logic, it just submits and lets Supabase accept
  or reject.

If any column name differs in your actual database, the fix is in one place:
`src/lib/data.js`.
