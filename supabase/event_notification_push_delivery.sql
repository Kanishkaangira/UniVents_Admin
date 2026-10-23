-- Track whether an approved event or notice push has already been sent.
-- Run once in the Supabase SQL Editor before deploying send-push.
alter table public.event_notifications
  add column if not exists push_sent_at timestamptz;

notify pgrst, 'reload schema';
