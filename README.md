# Sociétés Manager

A Next.js 14 (App Router, TypeScript) app to create, edit and delete company
registration records ("sociétés") for the UAE — structure type, free zone,
activity, proposed company names, shareholders, accounting option and
supporting documents — persisted in Supabase (Postgres + Storage).

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free tier is enough).
2. Click **New project**, pick an organization, name and database password,
   choose a region, and click **Create new project**. Wait a minute or two
   for it to provision.

## 2. Find your project URL and anon key

1. In your Supabase project, open **Project Settings** (gear icon) > **API**.
2. Copy the **Project URL** — this is `NEXT_PUBLIC_SUPABASE_URL`.
3. Copy the **anon / public** key under **Project API keys** — this is
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## 3. Create the database

In the Supabase **SQL Editor**, run these files in order (each is idempotent):

1. `supabase/schema.sql`, `supabase/visa-schema.sql` (base tables, as before);
2. `supabase/migrations/0001` … `0005` (incremental changes);
3. `supabase/migrations/0006_company_model.sql`: the normalized company model
   (authority, legal form, licence type, activity, office, pricing, required
   documents, company, shareholder, name request, company document, visa
   application…) with CHECK constraints and guard triggers, so the business
   rules hold in the database and not only in the UI;
4. `supabase/migrations/0007_migrate_societes_to_company.sql`: copies the old
   `societes` rows into `company` (same ids, `is_legacy = true`), re-points
   support tickets / company users / visas, then renames `societes` to
   `societes_legacy` (kept for reference; drop it once checked);
5. `supabase/migrations/0008_profile_change_request.sql`: profile change requests
   (name, e-mail, status manager/shareholder) submitted from `/profil` and
   processed in Backoffice MAO > Demandes de profil. Approved values are shown
   over the Auth metadata; login credentials are not modified.
6. `supabase/migrations/0009_backoffice_review.sql`: the KYC of shareholders moves
   from the client's flow to the MAO review (a file can be submitted without
   KYC; KYC can only start once submitted; the name cannot be approved until
   every person is VERIFIED), and `company_correction_request` (corrections /
   additional requests raised by MAO towards a company or one of its visa
   applications; a file cannot advance, nor a visa be granted, while one is
   pending).
7. `supabase/migrations/0010_lease_and_optional_documents.sql`: mainland Ejari
   lease choice (`company.lease_mode` OWN / MAO, required before submission;
   with OWN the company uploads its own `EJARI_LEASE` document and the office is
   not billed), optional required documents (`is_optional`, e.g. the manager's
   residence visa) and conditional ones (`required_when`).
8. `supabase/migrations/0011_correction_waiver.sql`: a pending request blocks
   the next step of the file (name approval, initial approval, licence) and the
   grant of a visa, unless MAO waives it (`is_blocking = false`, with a mandatory
   explanation of 10+ characters; one-way, the explanation cannot be edited).
9. `supabase/migrations/0012_contact_identification_and_dev_requests.sql`:
   contact tickets gain `requester_phone` and `is_visitor`; new table
   `dev_request` (requests to the developer team: feature / change / bug,
   priority, status, mandatory comment when declined).
10. `supabase/seed/demo_reference_data.sql`: **fictional "[DÉMO]" reference
   data** (authorities, legal forms, activities, offices, prices, required
   documents). Replace with real figures before any real use. Catalogue labels
   come from the database and are French only.

Optional: `supabase/tests/profile_request_constraints.sql` and `supabase/tests/company_constraints.sql` run (each is a single statement ending with a rollback; the result "TESTS OK" appears as an error message, that is expected) positive/negative
tests inside a rolled-back transaction.

> **Note:** RLS policies are intentionally permissive (demo). Scope them to an
> authenticated user before real use.

## 4. Create the Storage bucket for documents

1. Still in the **SQL Editor**, open a new query, paste the contents of
   [`supabase/storage-setup.sql`](./supabase/storage-setup.sql), and click
   **Run**.
2. This creates a public `societes-documents` Storage bucket and permissive
   demo policies letting the anon key upload/read/delete files in it (same
   "tighten for production" caveat as above — see the file's comments).
3. Alternatively you can create the bucket manually in **Storage** in the
   Supabase dashboard, name it `societes-documents`, mark it **Public**, and
   run only the `create policy ...` statements from that file.

## 5. Configure environment variables

1. Copy the example env file:

   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and fill in the two values from step 2:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

If these variables are missing, the app still builds and runs — it will show
an on-page message explaining how to configure Supabase instead of crashing.

## 6. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 7. Build for production

```bash
npm run build
npm start
```

## 8. Deploy to Vercel

1. Push this project to a Git repository (GitHub/GitLab/Bitbucket).
2. Go to [vercel.com](https://vercel.com), **Add New... > Project**, and
   import the repository.
3. In the project's **Settings > Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Vercel will run `npm run build` automatically.

## Authentication

- `app/login/page.tsx` and `app/inscription/page.tsx` are a login and
  sign-up page, sharing `components/auth/AuthLayout.tsx` (a split
  indigo-illustration / white-form layout). Both use Supabase Auth's
  built-in password flow directly from the browser:
  `auth.signInWithPassword` for login, `auth.signUp` (with `first_name` /
  `last_name` in `options.data`) for sign-up — see `lib/auth.ts`.
- On successful login, the user is redirected to `/` (the société list). On
  sign-up, since Supabase's default is to require email confirmation, the
  page shows a "check your inbox" confirmation message instead of assuming
  an active session.
- Forms use react-hook-form + Zod (`lib/auth-schema.ts`), same pattern as
  the société wizard, with inline validation (required fields, email
  format, 6-character minimum password, matching password confirmation on
  sign-up).
- `components/AuthStatus.tsx`, wired into `Header.tsx`, shows a "Log out"
  control when a Supabase session exists and a "Log in" link otherwise. This
  is presentational session awareness only — no page is gated behind auth
  (no middleware/route protection), by design for this task's scope.
- No SQL changes were needed: Supabase Auth's `auth.users` table is fully
  managed by Supabase, and the Email provider is enabled by default. See
  [`supabase/auth-notes.md`](./supabase/auth-notes.md) for the two default
  behaviors worth knowing about (email confirmation, redirect URLs).

## Company creation flow

`/societes/nouvelle` is an 11-step wizard: regime, authority, structure,
activities, names, office, shareholders & manager, documents, summary (each
section editable), payment, submission & tracking (`components/company-wizard/`). Rules live in
`lib/company-domain.ts` (pure, unit-tested with `npm test`) and are mirrored by
the database guards in migration 0006; Server Actions are in
`app/actions/companies.ts`.

Nationality / parent-company country are a select of all 249 ISO countries (`lib/countries.ts`, names in the UI language, English name stored). Every screen has a **Save as draft** button: what is filled in is kept (even
incomplete) and the draft is resumed from `/societes` on its first incomplete
screen. In mainland, the Ejari-registered office is picked automatically and the
company says, on the Documents screen, whether it brings its own lease or lets
MAO take care of it. The manager's residence visa is optional.

Simulated in this demo: Sumsub KYC, the payment (guichet package + MAO fee) and
the submission to the authority. Follow-up (review, name approved/refused,
initial approval, licence issued) is done by hand in **Backoffice MAO**.
Limitations: a manager who is not a shareholder is not supported; activities
needing an external approval are excluded; a licence has a single licence type.

## Backoffice dossier and corrections

`/backoffice/societes/[id]` shows the whole file of a company, in creation or
created (answers, uploaded documents, shareholders with the KYC check run by
MAO, payment, history, the company's visa applications); `/backoffice/visas/[id]`
shows a whole visa application. From both, MAO raises a correction or an
additional request: the company sees it on its Dashboard, on the follow-up page
(or the wizard / visa form) and answers with a text and/or files; MAO then
closes it. Limitation: once a file is submitted its structure, activities,
shareholders and names are frozen by the database, so an answer on those points
is a message (and files), not an edit.

## Navigation and requests

Administration (société manager): `/administration/demandes` ("Gestion de
demandes": the requests MAO sent to the company, answered here, plus support
tickets), `/administration/visas` ("Gestion de visa", formerly `/visas`) and
`/administration/utilisateurs`. The À propos, Visa and draft pages only show a
notification linking to "Gestion de demandes". Backoffice MAO has its own
`/backoffice/demandes`: every request sent to every company, to follow, close
or raise. Old addresses (`/visas`, `/administration/mes-demandes`) redirect.

## Connection profiles

Two profiles (`lib/profiles.ts`): **Société** (the société area and its
Administration) and **Backoffice MAO** (access to everything, plus the Backoffice
and Support inbox). The profile in use is shown in the header; accounts that have
both can switch from that chip (the switch lands on `/backoffice/societes` or
`/`). Who may use which profile: `app_metadata.profiles` of the Supabase Auth
user (SQL in `supabase/seed/demo_profiles.sql`), plus, for the demo, the e-mails
in `DEMO_MULTI_PROFILE_EMAILS` (already `espoirbatawila@conanjeken.com`) or in
the env var `NEXT_PUBLIC_DEMO_MULTI_PROFILE_EMAILS`. Any other account is a
société user. The société profile does not know `/backoffice` and `/support`:
those paths show a plain 404 without header or sidebar and no link points to
them. Limits: the guard is client-side only (the page data payload is not
protected) and the RLS policies are still the permissive demo ones — real isolation needs RLS keyed on the profile and on
the user's société.

## Notifications (bell)

The bell in the header (next to the language flag) is scoped on the server
(`app/actions/notifications.ts`): in the société area it only shows the open MAO
requests of the **active société**; with the Backoffice profile it shows what comes from
the companies (answers, profile requests, support tickets, submitted files).
The audience follows the connection profile in use
(`useNotificationAudience` in `components/NotificationBell.tsx`). Backoffice "Gestion des sociétés" flags the
companies that have pending requests and links to them.

## Project structure

- `app/actions/companies.ts` — company catalogue, wizard saves, simulated
  KYC/payment/submission and backoffice transitions.
- `app/societes/…` — list, wizard (`nouvelle`, `[id]/modifier`), tracking
  (`[id]/suivi`). UI components keep the historical `Societe*` naming.
- `components/company-wizard/`, `components/societe/`, `components/admin/`.
- `lib/company-*.ts` — types, domain rules, Zod schemas, wizard steps, view helpers.
- `lib/supabaseClient.ts` — lazy Supabase client (`no-store` fetch).
- `lib/i18n.ts` — fr/en dictionary (keep key parity).
- `supabase/` — schema, migrations, demo seed, SQL tests, storage setup.

## Contact and support

- **Nous contacter** (`/contact`) is public: reachable from the header on every
  page, including login/signup, for visitors without an account. The form asks
  first name, last name, e-mail, phone (optional), company (optional), subject
  and message; logged-in users get their details prefilled, visitors are flagged.
- Contact messages are handled in **Backoffice > Gestion de demandes** (tab
  "Messages de contact"); the backoffice bell links to it.
- **Support** (`/support`, Backoffice only) is the channel to the developer team:
  requests for changes or new features (`dev_request` table).

### E-mail of "Nous contacter"

Each message is stored as a ticket **and** e-mailed to `contact@mao.com`
(`CONTACT_TO_EMAIL`, reply-to = the sender) through Resend (`lib/mailer.ts`).
Set `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` (verified sender domain) in the
environment; without the key nothing is e-mailed (a warning is logged) and the
message only appears in Backoffice > Gestion de demandes.
