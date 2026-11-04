# Auth setup notes

The login (`/login`) and sign-up (`/inscription`) pages use Supabase Auth's
built-in email/password flow (`auth.signInWithPassword` /
`auth.signUp`) via `@supabase/supabase-js`. There is **no custom SQL** to run
for this — `auth.users` and everything else under `auth.*` is fully managed
by Supabase itself, and email/password (the "Email" provider) is **enabled
by default** on every new Supabase project.

Nothing to configure for the demo to work, but two defaults are worth
knowing about:

- **Email confirmations are on by default.** After sign-up, Supabase sends a
  confirmation email and the new user has no session until they click the
  link — the sign-up page shows a "check your inbox" message for this case
  instead of redirecting straight in. To skip this in a dev/demo project,
  turn it off in the dashboard under **Authentication > Providers > Email >
  Confirm email**.
- **Redirect URLs.** If you later add email confirmation or magic-link
  redirects that should land back on this app, add your app's URL under
  **Authentication > URL Configuration > Redirect URLs** in the Supabase
  dashboard.

No changes were made to `supabase/schema.sql` or `supabase/storage-setup.sql`
for this feature.
