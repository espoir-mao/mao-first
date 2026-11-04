-- Connection profiles (optional): lets an account use both the "Société" and the
-- "Backoffice MAO" profiles. The app reads auth.users.raw_app_meta_data.profiles,
-- which a user cannot edit from the browser. Without this, an account is a
-- société user — except the demo e-mails listed in lib/profiles.ts
-- (DEMO_MULTI_PROFILE_EMAILS) and in NEXT_PUBLIC_DEMO_MULTI_PROFILE_EMAILS.
-- Run in the Supabase SQL editor; the person must sign out and in again.

-- both profiles (can switch):
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"profiles":["SOCIETE","BACKOFFICE"]}'::jsonb
 where email = 'espoirbatawila@conanjeken.com';

-- a MAO-only user would simply have:  '{"profiles":["BACKOFFICE"]}'
-- (a backoffice user also gets the société area).
