# UniVents Admin — setup

1. `npm install @supabase/supabase-js react-router-dom`
2. `npm install -D tailwindcss postcss autoprefixer` then `npx tailwindcss init -p`
   (skip the init if tailwind.config.js / postcss.config.js already exist — just
   overwrite them with the ones in this zip)
3. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key
   (same values as the mobile app's `src/Constants/env.js`)
4. Ensure `supabase/skill_faculty_department.sql` has been run. Then run
   `supabase/skill_faculty_scope_enum_values.sql` by itself in the Supabase SQL
   Editor and let it finish/commit before continuing.
5. Run `supabase/admin_skill_faculty_scope.sql`. It migrates existing faculty
   admin assignments, makes `admins.department_id` reference `department`,
   adds `admins.skill_faculty_id`, and installs Skill Faculty and Department
   post targeting and approval routing.
6. Run `supabase/admin_auth_policy.sql` in the Supabase SQL Editor. Each row in
   `public.admins` must use the corresponding Supabase Auth user's UUID as `id`.
   Admin passwords are managed by Supabase Auth, not stored in `public.admins`.
7. Run `supabase/admin_management_policy.sql` after `admin_auth_policy.sql`.
   It grants admin/organization writes only to authenticated super admins.
   Then run `supabase/admin_skill_faculty_management.sql` to allow Super admins
   to add, edit, and delete Skill Faculties in Administration. Departments link
   to a Skill Faculty through their existing `skill_faculty_id`; clubs remain
   independent.
8. Run `supabase/admin_events_created_by_auth_fk.sql` so `events.created_by`
   references `auth.users` and accepts admins without a `profiles` row.
9. Run `supabase/admin_event_insert_policy.sql` to let admins create event and
   notice rows with `created_by` set to their own Auth UUID.
10. Run `supabase/admin_storage_policy.sql`. It creates/configures the public
   `event-posters` bucket and lets admins upload to `Events Folder/` and
   `Notice Folder/`.
11. Run `supabase/creator_scope_approval.sql` to restore `creator_scope`, derive
   it from the signed-in creator's admin row.
12. Run `supabase/admin_scoped_approval_routing.sql`, then rerun
    `supabase/admin_skill_faculty_scope.sql` to install the final target-admin
    approval routing and admin scope access rules. Posts targeting another
    department must wait in that department's Pending approvals inbox.
13. Run `supabase/admin_approval_review_fix.sql` after the approval-routing
    scripts. It installs the review RPC, routes Pending inbox results to the
    target admin, and returns a rejected post to Pending whenever it is saved
    again, even if no content field changed.
14. Run `supabase/admin_posts_visible_to_all_admins.sql` so every admin can
    view all posts while non-admin app users see approved posts only.
15. Run `supabase/admin_post_creator_mutation_policy.sql` so only the creator
    or a Super admin can delete posts, while target-scope admins can edit
    rejected posts to resubmit them.
16. Run `supabase/admin_event_registration_counts.sql` to show registration
    totals on event cards without exposing attendee details.
17. Run `supabase/event_status_by_date.sql` to set event status from its date
    and schedule the daily refresh (requires `pg_cron` for automatic midnight updates).
18. `npm run dev`

The admin page can promote an existing Auth user by UUID; it does not create
Auth users or store passwords.

## Event push delivery
- The admin web app invokes `send-push` directly with the approved event ID
  and the signed-in admin session. The function also accepts the database
  webhook payload if that integration is configured.
- Super admins can use Administration > Notifications to send an App update
  or University update. Both are saved as approved University event posts and
  use the same `send-push` call as other approved events; the selected type is
  stored in the post category.
- Set the Firebase service-account JSON as the `FIREBASE_SERVICE_ACCOUNT`
  Edge Function secret. Do not put that JSON in either app repository.
- Deploy `supabase/functions/send-push` with JWT verification disabled; the
  function validates admin sessions and webhook service keys itself. Run
  `supabase/event_notification_push_delivery.sql` first to add the one-time
  push claim column.
- From the linked UniVents mobile project, deploy the compatible function with
  `supabase functions deploy send-push --no-verify-jwt`.
- After adding Firebase Messaging or changing Android notification code,
  rebuild and reinstall the React Native app. Users must allow notifications;
  the app subscribes signed-in students and faculty to `all` and their role
  topic.

## Admin scope access
- All registered admins can view posts across all scopes. The creator and Super
  admins can edit/delete posts; target-scope admins can edit rejected posts
  only, to resubmit them for review.
- Super admins can review any pending post. Skill Faculty, Department, and Club
  admins receive pending posts addressed to their assigned target scope.
- Every admin can submit a post to any publish level. Posts within the creator's
  exact scope are approved automatically; posts for another department,
  Skill Faculty, club, or University wait for approval in the target admin's
  Pending approvals inbox. Target-scope admins can edit rejected posts from My
  posts to return them to Pending for review again, including when they save
  without changing fields. Resubmission sends no push; pushes are handled
  after approval. App users see a post only after it is approved.
- After changing approval routing, rerun `supabase/admin_skill_faculty_scope.sql`
  and `supabase/admin_post_creator_mutation_policy.sql` in the Supabase SQL
  Editor so cross-scope posts wait for the target admin and rejected posts can
  be resubmitted by target-scope admins.
- Supabase RLS and approval functions enforce these boundaries.

## Assumptions this code makes about your schema
- `public.admins` has `id`, `email`, `scope_type`, `department_id`,
  `skill_faculty_id`, and `club_id`;
- `admins.department_id` references `public.department`; `admins.skill_faculty_id`
  references `public.skill_faculty`;
   `id` is the matching `auth.users.id` UUID. Login credentials are checked by
   Supabase Auth, then `current_admin()` returns only the signed-in user's row.
- `events` has: content_type, title, description, category, organizer_name,
  department_id, skill_faculty_id, club_id, event_date, start_time, end_time, venue,
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
