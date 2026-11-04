import { Hono } from 'hono'

import { privateJson } from '../auth'
import { logAudit, now, requireAdmin } from '../db'
import type { AppContext } from '../env'

/**
 * The site owner manages live role rows through the Settings page, not a console.
 * Every mutation here is admin-only and recorded in audit_log.
 */
export const admin = new Hono<AppContext>()

admin.get('/admin/roles', requireAdmin, async (c) => {
  const rows = await c.get('db')
    .prepare(`SELECT email, role, created_at FROM roles ORDER BY email`)
    .all<{ email: string; role: string; created_at: number }>()
  return privateJson(c, { roles: rows.results })
})

/** Used to refuse a change that would leave nobody able to administer the site. */
async function adminCount(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM roles WHERE role = 'admin'`).first<{ n: number }>()
  return Number(row?.n ?? 0)
}

admin.post('/admin/roles', requireAdmin, async (c) => {
  const db = c.get('db')
  const { email, role } = await c.req.json<{ email?: string; role?: string }>()
  if (!email || !role) return c.json({ error: 'Invalid request.', message: 'email and role are required.' }, 400)
  const normalized = email.trim().toLowerCase()
  if (!normalized) return c.json({ error: 'Invalid request.', message: 'email must not be empty.' }, 400)
  // A role row is keyed by email and matched against the sign-in address, so a
  // malformed address can never grant access and would only sit there forever.
  if (!EMAIL.test(normalized)) return c.json({ error: 'invalid_email', message: 'Enter a valid email address for the role.' }, 400)
  if (role !== 'admin' && role !== 'student') return c.json({ error: 'Invalid request.', message: 'role must be admin or student.' }, 400)

  // Demoting the only admin would lock every account out of the library forever.
  const existing = await db.prepare(`SELECT role FROM roles WHERE email = ?`).bind(normalized).first<{ role: string }>()
  if (existing?.role === 'admin' && role === 'student' && (await adminCount(db)) <= 1) {
    return c.json({ error: 'last_admin', message: 'This is the only admin. Promote another account first.' }, 409)
  }

  await db.prepare(`INSERT OR REPLACE INTO roles (email, role, created_at) VALUES (?, ?, ?)`).bind(normalized, role, now()).run()
  await logAudit(db, c.get('user'), 'role.set', normalized, role)
  return privateJson(c, { ok: true })
})

admin.delete('/admin/roles/:email', requireAdmin, async (c) => {
  const db = c.get('db')
  const { email } = c.req.param()
  const normalized = email.trim().toLowerCase()
  if (!normalized) return c.json({ error: 'Invalid request.', message: 'email must not be empty.' }, 400)
  const existing = await db.prepare(`SELECT role FROM roles WHERE email = ?`).bind(normalized).first<{ role: string }>()
  if (existing?.role === 'admin' && (await adminCount(db)) <= 1) {
    return c.json({ error: 'last_admin', message: 'This is the only admin. Promote another account first.' }, 409)
  }
  await db.prepare(`DELETE FROM roles WHERE email = ?`).bind(normalized).run()
  await logAudit(db, c.get('user'), 'role.remove', normalized)
  return privateJson(c, { ok: true })
})

/** Recent privileged actions. Admin-only, and never cached. */
admin.get('/admin/audit', requireAdmin, async (c) => {
  const rows = await c.get('db')
    .prepare(`SELECT id, actor_sub, actor_email, action, target, detail, created_at FROM audit_log ORDER BY created_at DESC LIMIT 200`)
    .all<{ id: string; actor_sub: string; actor_email: string | null; action: string; target: string | null; detail: string | null; created_at: number }>()
  return privateJson(c, { entries: rows.results })
})

/**
 * A downloadable JSON snapshot of everything that cannot be regenerated: the
 * library, its cards, the role list and every study session. D1 keeps its own
 * point-in-time restore, but that is not something the site owner can reach, so
 * this is the copy they can actually keep.
 */
admin.get('/admin/backup', requireAdmin, async (c) => {
  const db = c.get('db')
  const [decks, cards, progress, roles, sessions] = await db.batch([
    db.prepare(`SELECT * FROM decks ORDER BY created_at`),
    db.prepare(`SELECT * FROM cards ORDER BY deck_id, position`),
    db.prepare(`SELECT * FROM card_progress_v2`),
    db.prepare(`SELECT email, role, created_at FROM roles ORDER BY email`),
    db.prepare(`SELECT * FROM sessions ORDER BY created_at`),
  ])
  c.header('content-disposition', `attachment; filename="myclassroom-backup-${new Date().toISOString().slice(0, 10)}.json"`)
  return privateJson(c, {
    version: 2,
    exportedAt: now(),
    decks: decks.results,
    cards: cards.results,
    progress: progress.results,
    roles: roles.results,
    sessions: sessions.results,
  })
})

// --- Restore -----------------------------------------------------------------
// A snapshot is untrusted input: it may be hand-edited, stale, or from an older
// export. Every column is read explicitly and clamped, so the file can never
// write a field or a value the tables do not expect.

const MAX_DECKS = 500
const MAX_CARDS = 10_000
const MAX_PROGRESS = 20_000
const MAX_SESSIONS = 10_000
const MAX_ROLES = 500
const MAX_SNAPSHOT_BYTES = 25 * 1024 * 1024
const STUDY_MODES = new Set(['flashcards', 'learn', 'match'])
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Snapshot = Record<string, unknown>

const text = (value: unknown, max = 200): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}
const whole = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback)
const maybe = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null)
const objects = (value: unknown): Snapshot[] =>
  Array.isArray(value) ? (value.filter((row) => Boolean(row) && typeof row === 'object' && !Array.isArray(row)) as Snapshot[]) : []

/**
 * Restores a snapshot produced by GET /admin/backup.
 *
 *   ?mode=merge   (default) upserts by id; nothing is deleted.
 *   ?mode=replace clears the library, progress, sessions and roles first, and
 *                 needs ?confirm=replace because it is destructive.
 *
 * Refuses any snapshot that would leave the restoring account (or everyone)
 * without an admin, so a restore can never lock the site out.
 */
admin.post('/admin/restore', requireAdmin, async (c) => {
  const db = c.get('db')
  const user = c.get('user')

  const requested = c.req.query('mode') ?? 'merge'
  if (requested !== 'merge' && requested !== 'replace') {
    return c.json({ error: 'Invalid request.', message: 'mode must be merge or replace.' }, 400)
  }
  const mode = requested
  if (mode === 'replace' && c.req.query('confirm') !== 'replace') {
    return c.json({ error: 'confirm_required', message: 'Replacing deletes the current library, progress and sessions first. Add ?confirm=replace.' }, 400)
  }
  if (Number(c.req.header('content-length') ?? 0) > MAX_SNAPSHOT_BYTES) {
    return c.json({ error: 'file_too_large', message: 'That snapshot is too large to restore.' }, 413)
  }

  let body: Snapshot
  try {
    const parsed: unknown = await c.req.json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('not an object')
    body = parsed as Snapshot
  } catch {
    return c.json({ error: 'Invalid request.', message: 'Send the JSON file downloaded from /api/admin/backup.' }, 400)
  }

  const version = whole(body.version, 0)
  if (version !== 1 && version !== 2) {
    return c.json({ error: 'unsupported_version', message: 'Only a snapshot exported by this app (version 1 or 2) can be restored.' }, 400)
  }

  const deckInput = objects(body.decks)
  const cardInput = objects(body.cards)
  const progressInput = objects(body.progress)
  const roleInput = objects(body.roles)
  const sessionInput = objects(body.sessions)
  if (!deckInput.length && !cardInput.length && !progressInput.length && !roleInput.length && !sessionInput.length) {
    return c.json({ error: 'Invalid request.', message: 'That file has no decks, cards, progress, sessions or roles to restore.' }, 400)
  }

  const deckRows = deckInput.slice(0, MAX_DECKS).flatMap((raw) => {
    const deckId = text(raw.id, 100)
    const title = text(raw.title, 80)
    if (!deckId || !title) return []
    return [
      {
        id: deckId,
        ownerSub: text(raw.owner_sub, 200) ?? user.sub,
        title,
        description: text(raw.description, 300),
        hue: Math.abs(whole(raw.hue, 250)) % 360,
        shared: raw.shared === 1 || raw.shared === true ? 1 : 0,
        lastStudiedAt: maybe(raw.last_studied_at),
        createdAt: whole(raw.created_at, Date.now()),
        updatedAt: whole(raw.updated_at, Date.now()),
      },
    ]
  })

  const cardRows = cardInput.slice(0, MAX_CARDS).flatMap((raw) => {
    const cardId = text(raw.id, 100)
    const deckId = text(raw.deck_id, 100)
    if (!cardId || !deckId) return []
    return [
      {
        id: cardId,
        deckId,
        ownerSub: text(raw.owner_sub, 200) ?? user.sub,
        term: text(raw.term, 300) ?? '',
        definition: text(raw.definition, 600) ?? '',
        imageKey: text(raw.image_key, 400),
        fileName: text(raw.file_name, 120),
        fileSize: whole(raw.file_size, 0),
        fileType: text(raw.file_type, 120),
        position: whole(raw.position, 0),
        createdAt: whole(raw.created_at, Date.now()),
      },
    ]
  })

  // Attachment bodies live in R2, not in the snapshot. A key whose object is
  // gone is dropped rather than left pointing at nothing. Verification is
  // skipped for very large snapshots to stay inside the subrequest budget.
  const bucket = c.env.FILES
  const imageKeys = [...new Set(cardRows.map((card) => card.imageKey).filter((key): key is string => Boolean(key)))]
  const missingKeys = new Set<string>()
  const verifying = Boolean(bucket) && imageKeys.length > 0 && imageKeys.length <= 50
  if (bucket && verifying) {
    for (const key of imageKeys) if (!(await bucket.head(key))) missingKeys.add(key)
  }

  const progressRows = progressInput.slice(0, MAX_PROGRESS).flatMap((raw) => {
    const ownerSub = text(raw.owner_sub, 200)
    const cardId = text(raw.card_id, 100)
    const deckId = text(raw.deck_id, 100)
    if (!ownerSub || !cardId || !deckId) return []
    return [
      {
        ownerSub,
        cardId,
        deckId,
        correct: Math.max(0, whole(raw.correct)),
        incorrect: Math.max(0, whole(raw.incorrect)),
        streak: Math.max(0, whole(raw.streak)),
        mastery: Math.min(100, Math.max(0, whole(raw.mastery))),
        nextDue: maybe(raw.next_due),
        lastSeen: maybe(raw.last_seen),
      },
    ]
  })

  const sessionRows = sessionInput.slice(0, MAX_SESSIONS).flatMap((raw) => {
    const sessionId = text(raw.id, 100)
    const deckId = text(raw.deck_id, 100)
    const studyMode = text(raw.mode, 20)
    if (!sessionId || !deckId || !studyMode || !STUDY_MODES.has(studyMode)) return []
    const total = Math.max(0, whole(raw.total))
    return [
      {
        id: sessionId,
        deckId,
        ownerSub: text(raw.owner_sub, 200) ?? user.sub,
        mode: studyMode,
        score: Math.min(total, Math.max(0, whole(raw.score))),
        total,
        durationMs: Math.max(0, whole(raw.duration_ms)),
        createdAt: whole(raw.created_at, Date.now()),
      },
    ]
  })

  const roleRows = roleInput.slice(0, MAX_ROLES).flatMap((raw) => {
    const email = text(raw.email, 200)?.toLowerCase()
    if (!email || !EMAIL.test(email)) return []
    const role = raw.role === 'admin' ? 'admin' : raw.role === 'student' ? 'student' : null
    if (!role) return []
    return [{ email, role, createdAt: whole(raw.created_at, Date.now()) }]
  })

  // Who would be admin afterwards, before anything is written.
  const callerEmail = user.email?.trim().toLowerCase() ?? null
  const final = new Map<string, string>()
  if (mode === 'merge') {
    const existing = await db.prepare(`SELECT email, role FROM roles`).all<{ email: string; role: string }>()
    for (const row of existing.results) final.set(row.email, row.role)
  }
  for (const row of roleRows) final.set(row.email, row.role)
  const hasAdmin = [...final.values()].includes('admin')
  if (callerEmail ? final.get(callerEmail) !== 'admin' : !hasAdmin) {
    return c.json(
      {
        error: 'last_admin',
        message: `This snapshot would leave ${callerEmail ?? 'the site'} without the admin restoring it. Keep that account as an admin in the file, or promote another admin first.`,
      },
      409,
    )
  }

  const statements: D1PreparedStatement[] = []
  const flush = async () => {
    for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40))
    statements.length = 0
  }

  // Attachment bodies are not in the snapshot. Remember what exists so a
  // replace can delete the objects the snapshot no longer references instead
  // of leaving them orphaned in R2 forever.
  let replacedKeys: string[] = []
  if (mode === 'replace' && c.env.FILES) {
    const existing = await db.prepare(`SELECT image_key FROM cards WHERE image_key IS NOT NULL`).all<{ image_key: string }>()
    replacedKeys = existing.results.map((row) => row.image_key)
  }

  // A replace starts clean, so ids that are absent from the snapshot really go.
  if (mode === 'replace') {
    statements.push(
      db.prepare(`DELETE FROM sessions`),
      db.prepare(`DELETE FROM card_progress_v2`),
      db.prepare(`DELETE FROM cards`),
      db.prepare(`DELETE FROM decks`),
      db.prepare(`DELETE FROM roles`),
    )
    await flush()
  }

  for (const row of roleRows) {
    statements.push(
      db
        .prepare(`INSERT INTO roles (email, role, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET role = excluded.role`)
        .bind(row.email, row.role, row.createdAt),
    )
  }
  await flush()

  for (const row of deckRows) {
    statements.push(
      db
        .prepare(
          `INSERT INTO decks (id, owner_sub, title, description, hue, shared, last_studied_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET owner_sub = excluded.owner_sub, title = excluded.title, description = excluded.description,
             hue = excluded.hue, shared = excluded.shared, last_studied_at = excluded.last_studied_at, updated_at = excluded.updated_at`,
        )
        .bind(row.id, row.ownerSub, row.title, row.description, row.hue, row.shared, row.lastStudiedAt, row.createdAt, row.updatedAt),
    )
  }
  await flush()

  for (const row of cardRows) {
    const key = row.imageKey && !missingKeys.has(row.imageKey) ? row.imageKey : null
    statements.push(
      db
        .prepare(
          `INSERT INTO cards (id, owner_sub, deck_id, term, definition, image_key, file_name, file_size, file_type, position, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET owner_sub = excluded.owner_sub, deck_id = excluded.deck_id, term = excluded.term,
             definition = excluded.definition, image_key = excluded.image_key, file_name = excluded.file_name,
             file_size = excluded.file_size, file_type = excluded.file_type, position = excluded.position`,
        )
        .bind(
          row.id,
          row.ownerSub,
          row.deckId,
          row.term,
          row.definition,
          key,
          key ? row.fileName : null,
          key ? row.fileSize : 0,
          key ? row.fileType : null,
          row.position,
          row.createdAt,
        ),
    )
  }
  await flush()

  for (const row of progressRows) {
    statements.push(
      db
        .prepare(
          `INSERT INTO card_progress_v2 (owner_sub, card_id, deck_id, correct, incorrect, streak, mastery, next_due, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(owner_sub, card_id) DO UPDATE SET deck_id = excluded.deck_id, correct = excluded.correct,
             incorrect = excluded.incorrect, streak = excluded.streak, mastery = excluded.mastery,
             next_due = excluded.next_due, last_seen = excluded.last_seen`,
        )
        .bind(row.ownerSub, row.cardId, row.deckId, row.correct, row.incorrect, row.streak, row.mastery, row.nextDue, row.lastSeen),
    )
  }
  await flush()

  for (const row of sessionRows) {
    statements.push(
      db
        .prepare(
          `INSERT INTO sessions (id, owner_sub, deck_id, mode, score, total, duration_ms, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET score = excluded.score, total = excluded.total, duration_ms = excluded.duration_ms`,
        )
        .bind(row.id, row.ownerSub, row.deckId, row.mode, row.score, row.total, row.durationMs, row.createdAt),
    )
  }
  await flush()

  if (mode === 'replace' && c.env.FILES && replacedKeys.length) {
    const keep = new Set(cardRows.map((row) => row.imageKey).filter((key): key is string => typeof key === 'string' && !missingKeys.has(key)))
    const remove = replacedKeys.filter((key) => !keep.has(key))
    try {
      for (let i = 0; i < remove.length; i += 100) await c.env.FILES.delete(remove.slice(i, i + 100))
    } catch (error) {
      console.error('restore attachment cleanup failed', error)
    }
  }

  const restored = {
    decks: deckRows.length,
    cards: cardRows.length,
    progress: progressRows.length,
    roles: roleRows.length,
    sessions: sessionRows.length,
  }
  const skipped =
    deckInput.length - deckRows.length +
    (cardInput.length - cardRows.length) +
    (progressInput.length - progressRows.length) +
    (roleInput.length - roleRows.length) +
    (sessionInput.length - sessionRows.length)

  await logAudit(
    db,
    user,
    'library.restore',
    mode,
    `${restored.decks} decks, ${restored.cards} cards, ${restored.progress} progress, ${restored.roles} roles, ${restored.sessions} sessions`,
  )

  return privateJson(c, {
    ok: true,
    mode,
    restored,
    skipped,
    // Attachment bodies are not part of the snapshot, only their keys.
    attachments: { referenced: imageKeys.length, missing: missingKeys.size, verified: verifying },
  })
})
