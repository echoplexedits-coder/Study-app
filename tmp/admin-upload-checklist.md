# Verify admin upload unblock

## What the live site must show
- `/api/auth/status` reports `database: true` and `files: true`.  
  That means production D1 `DB` and R2 `FILES` are attached. If either is false, there is no production storage and the admin upload path cannot work yet.

## Why the button is missing
- The app does not hardcode any admin flag.  
  `src/worker/db.ts` defines the role model: one row per admin email in the live `roles` D1 table, and `roleFor` resolves the caller's role from that table on every request.
- `src/worker/routes/account.ts` sets `canEdit: role === 'admin'` only when the signed-in email matches a role row with `role = 'admin'`.
- The client gates (Library, Deck, Settings) only show upload, create, delete, and restore when `canEdit` is true.

So the missing button means one of these:
1. the production `roles` table does not yet have a row for `echoplexedits@gmail.com` with `role = 'admin'`;
2. the email your real sign-in returns is different from the row in the live `roles` table;
3. the `DB` binding is missing, which would surface as a 503 on `/api/*` rather than as a missing button.

## How to unblock
### If your sign-in returns `echoplexedits@gmail.com`
Then the production role row is missing or was not deployed. The fix is to ensure the live D1 `roles` table has a row `('echoplexedits@gmail.com','admin')`. The codebase seeds that row once in `src/worker/db.ts`, so a fresh deploy into a clean production DB would include it automatically. An existing DB may not have it if the seed did not match the email.

### If your sign-in returns a different email
Then the live `roles` table must be edited to add a row for that email with `role = 'admin'`. That edit is made in the live D1, not in the workspace files, because the role model is database-driven and the app has no admin UI for editing `roles`.

## Immediate visible signal
Sign out, sign back in, open Settings. The badge under the avatar must read "Admin — can edit the library". Once it does, both the library "New deck" button and the deck's attachment upload control appear on the same screen, with no code change needed.

## What not to do
- Do not open the upload buttons to everyone. The requirement is explicit: normal users must not be able to upload, remove, or edit decks or flashcards.
- Do not hardcode `echoplexedits@gmail.com` into the role check. The role must come from the database, as the existing model in `src/worker/db.ts` already enforces.

## Edge cases to verify
- Signed out: profile shows "Student — read-only library", no admin button.
- Signed in as a non-admin email: no admin button, and create/upload/restore are blocked server-side.
- Signed in as the admin email: admin button present, create deck works, attachment upload works, Restore section appears.

## Files that matter
- `src/worker/db.ts` — role source, role resolution, `requireAdmin`, `roles` seed.
- `src/worker/routes/account.ts` — `/me` returns `capabilities.role` and `canEdit`.
- `src/app/pages/Library.tsx` — "Your decks / New deck" gated on `canEdit`.
- `src/app/pages/Deck.tsx` — add/edit/delete/attach gated on `canEdit && files`.
- `src/app/pages/Settings.tsx` — admin-only Restore section gated on `canEdit`.
- `src/worker/index.ts` — `/api` guarded by `requireUser`, `requireDb`, `loadRole`.
- `deploy.json` — only assets and entrypoint; no env secrets.
- `wrangler.jsonc` — local bindings only; production binds via Sites.

# Working tree clean before deploy
# After deploy: /api/auth/status unchanged, /api/health ok
