-- Supabase Storage setup for société documents.
-- Run this in the Supabase SQL editor AFTER schema.sql.

-- Create the bucket used by the app (public, so uploaded documents are
-- reachable via their public URL without extra signing logic — fine for a
-- demo/personal project, see the note below for production).
insert into storage.buckets (id, name, public)
values ('societes-documents', 'societes-documents', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- DEMO POLICIES ONLY — these allow the public "anon" key to upload, read and
-- delete any file in this bucket, which is fine for a quick demo or personal
-- project but is NOT safe for a real production app with multiple users.
-- Before shipping this for real, scope these policies to an authenticated
-- user (e.g. store files under a `${auth.uid()}/...` path prefix and check
-- `auth.uid()` against that prefix), and consider making the bucket private
-- and serving files through signed URLs instead of public ones.
-- ---------------------------------------------------------------------------

create policy "Demo: anyone can upload société documents"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'societes-documents');

create policy "Demo: anyone can read société documents"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'societes-documents');

create policy "Demo: anyone can delete société documents"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'societes-documents');

-- ---------------------------------------------------------------------------
-- Visa module: separate bucket for documents uploaded in the visa
-- application wizard (passport scans, photos, etc.). Same demo-only,
-- permissive policy shape as above — see the note above before using this
-- in production.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('visa-documents', 'visa-documents', true)
on conflict (id) do nothing;

create policy "Demo: anyone can upload visa documents"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'visa-documents');

create policy "Demo: anyone can read visa documents"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'visa-documents');

create policy "Demo: anyone can delete visa documents"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'visa-documents');

-- ---------------------------------------------------------------------------
-- Profile avatars: user-uploaded profile photos, shown in the header and on
-- the /profil page. Same demo-only, permissive policy shape as above — see
-- the note above before using this in production (in particular, scope
-- these to `${auth.uid()}/...` paths and check `auth.uid()` against that
-- prefix before shipping this for real).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Demo: anyone can upload avatars"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'avatars');

create policy "Demo: anyone can read avatars"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "Demo: anyone can delete avatars"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'avatars');
