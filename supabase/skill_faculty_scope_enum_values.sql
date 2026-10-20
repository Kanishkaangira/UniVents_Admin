-- Run this file by itself first so PostgreSQL commits both enum values before
-- the admin/event migration uses them in existing rows and constraints.
alter type public.admin_scope_enum add value if not exists 'skill_faculty';
alter type public.organizer_scope_enum add value if not exists 'skill_faculty';
