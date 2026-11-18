# MyClassroom

MyClassroom is a class-notes library for one class, with study tools beside it.
The site admin uploads handouts, slides, PDFs and images, filed by class,
subject and date. Students sign in to search, preview and download that
material, and can work through decks with flashcards, multiple-choice Learn and
a timed Match game. Each student's progress is stored separately.

The app runs on Cloudflare Workers with Hono, D1, R2 and a React/Vite client. It
is hosted on Freebuff Sites. The product name is `BRAND` in
`src/shared/types.ts`; change it once.

## What is in it

- **Notes-first library.** `/notes` lists classwork from R2, with search, class
  and subject filters, inline previews and downloads.
- **Admin-only publishing.** Only the site admin can create, edit, upload or
  delete class material. Student accounts are read-only.
- **Study tools.** Decks, cards, attachments, per-card mastery, streaks and a
  progress page. Sessions are recorded once from the study summary.
- **Accounts.** Freebuff, Google and username/password sign-in. Google accounts
  must have a verified email to hold a role; Freebuff is itself the provider.
  Password accounts are always students, even if their email matches a role.
- **Safety controls.** Consent gate and policy version in `src/shared/legal.ts`,
  reports, account deletion, admin audit log and last-admin protection.

## Run it

```sh
bun install
bun run dev        # Vite client with the local Worker
bun run typecheck
bun test
bun run build
```

`bun run build` writes:

- `dist/client/` — static assets, including the prerendered `landing.html`
- `dist/study/index.js` — the Worker bundle
- `dist/study/wrangler.json` — the build-time Worker configuration

### Local accounts

With no `FREEBUFF_CLIENT_ID` and a loopback origin, the Worker signs requests in
as the development user so the app is usable before auth is provisioned. With a
real provider configured, use the sign-in page. Username/password accounts work
whenever D1 is attached.

The local Worker can be run directly with Wrangler and an isolated state
directory:

```sh
bunx wrangler dev --local --port 8787 --ip 127.0.0.1 \
  --persist-to /tmp/myclassroom-wrangler-state
```

That uses local D1 and R2. Lifecycle requests need the matching `Origin`; for
example `Origin: http://127.0.0.1:8787`.

## Deploy on Freebuff Sites

1. Create a Sites project.
2. Add D1 storage bound as `DB`, and R2 storage bound as `FILES`.
3. Enable Sign in with Freebuff and/or configure Google OAuth. Keep OAuth
   secrets in Sites secrets, never in the repository or a committed env file.
4. Run `bun run build`.
5. Deploy with the manifest in `deploy.json`.

The app is a Worker, not a Node server. The Worker serves `/api/*` and falls
back to `ASSETS` for the client. Do not upload `.dev.vars`, source maps or the
repository itself as public assets.

## Auth and permissions

`src/worker/db.ts` owns role resolution:

- `local:*` password accounts never receive an email-based role.
- `google:*` requires `email_verified === true`.
- Other provider identities, including Freebuff, are trusted.
- A password sign-up cannot claim an email that already belongs to a provider
  account or a role row (`emailConflict` in `src/worker/identity.ts`).

The last admin cannot be demoted, suspended or deleted. The shared guard is
`isLastAdminChange` and `adminRoleCount` in `src/worker/db.ts`; see
`tests/admin-guard.test.ts`.

## Data and backups

`GET /api/admin/backup` (admin only) downloads a JSON file containing:

- `decks`, `cards`, `card_progress_v2`, `roles` and `sessions` rows from D1;
- an `r2` manifest with every object's key, byte size, upload time and content
  type, plus total files and bytes;
- `version` and `exportedAt`.

**The JSON does not contain file bytes.** The manifest is a list, not a copy.
To keep an actual copy of the files:

- classwork: while signed in, `GET /api/notes/file/<key>`;
- card attachments: `GET /api/decks/<deckId>/cards/<cardId>/file`;
- deck covers: `GET /api/decks/<deckId>/cover`;
- or use the R2 dashboard/bucket tooling to download the listed keys.

The admin Settings page shows the last backup export and warns when it is more
than seven days old. The timestamp is recorded in `audit_log` by the export
route. A download on another device is outside the app and cannot be deleted by
the app.

New schema changes are additive: `ensureSchema` creates missing tables and adds
missing columns rather than rewriting existing rows. The one historical
`card_progress` migration copies rows to `card_progress_v2` before removing the
old table; do not add another destructive migration.

## Limits

- One file: 90 MiB (`MAX_ATTACHMENT_BYTES` in `src/shared/types.ts`).
- R2 allowance used by the usage panel: 1 GiB. The admin file dashboard shows
  bytes used, object count, remaining space and a warning at 80%. An upload
  that would exceed the allowance is refused with `storage_full` (507).
- Request counts are not exposed to the Worker, so the panel does not invent
  them.

## Where things are

- `src/worker/index.ts` — Worker entry, security headers and the `/` static
  landing vs app-shell split. Only real auth cookies select the app shell.
- `src/worker/routes/notes.ts` — signed-in classwork listing and private file
  responses with ETags and 304s. Card attachments and covers are excluded.
- `src/worker/routes/admin-files.ts` — admin upload/delete, R2 usage and the
  storage limit.
- `src/worker/routes/admin.ts` — roles, audit, backup and restore.
- `src/worker/routes/admin-users.ts` — roster, suspension and the reset-link
  queue.
- `src/worker/routes/auth.ts` — registration, password sign-in, logout and
  reset requests; `src/worker/identity.ts` holds password/session primitives.
- `src/worker/google.ts` — Google OAuth and the signed Google session cookie.
- `src/app/pages/` — `Notes.tsx` for the library, `Library.tsx` for decks,
  `UploadDashboard.tsx` for admin uploads, `AdminUsers.tsx` for the reset queue,
  `Legal.tsx` for the published policies and `Consent.tsx` for the gate.
- `src/shared/legal.ts` — policy version, effective date, contact address and
  legal-page labels. Bump the version and date only when the meaning changes.
- `src/worker/db.ts` — schema, roles, audit and access guards.
- `src/styles.css` — design tokens.

## Security notes

- `/api/*` requires a session except the explicitly public auth, contact and
  health routes. Mutations require a same-origin request.
- Queries are scoped to the signed-in owner. Class material is shared; private
  card attachments and covers remain private.
- Note files are served `private, max-age=3600` with an ETag; they are never
  cacheable by a shared proxy. Image/document responses use `nosniff`.
- Admin actions are written to `audit_log`.
- Password hashes use PBKDF2-SHA256 at 600,000 iterations. Session tokens are
  stored hashed; reset tokens are single-use and expire after 30 minutes.
- The public landing page is rendered without JavaScript. Class material is
  never included in it.

## Tests

`bun test` currently covers role resolution and email conflicts, the last-admin
guard, and the landing-page cookie split. `bun run typecheck` and
`bun run build` must also pass before deploying.
