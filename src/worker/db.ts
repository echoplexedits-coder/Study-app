import type { MiddlewareHandler } from 'hono'
import type { FreebuffUser } from '@freebuff/auth'

import type { AppContext } from './env'
import type { Role } from '../shared/types'

// Schema lives with the Worker: D1 has no migration tool on Freebuff Sites, so
// tables are created on the first request of each isolate. Add new statements
// at the end; never edit existing ones in place once deployed.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    owner_sub TEXT PRIMARY KEY,
    seeded_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    hue INTEGER NOT NULL DEFAULT 250,
    last_studied_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS decks_owner ON decks(owner_sub, updated_at DESC)`,
  `CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    deck_id TEXT NOT NULL,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    image_key TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cards_deck ON cards(owner_sub, deck_id, position)`,
  `CREATE TABLE IF NOT EXISTS card_progress (
    card_id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    deck_id TEXT NOT NULL,
    correct INTEGER NOT NULL DEFAULT 0,
    incorrect INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    mastery INTEGER NOT NULL DEFAULT 0,
    next_due INTEGER,
    last_seen INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS progress_deck ON card_progress(owner_sub, deck_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    owner_sub TEXT NOT NULL,
    deck_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(owner_sub, created_at DESC)`,
  // Who may manage the library. Admins are rows here, not a list in the code,
  // so a role can be granted or revoked by editing one table.
  `CREATE TABLE IF NOT EXISTS roles (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `INSERT OR IGNORE INTO roles (email, role, created_at)
    VALUES ('echoplexedits@gmail.com', 'admin', CAST(strftime('%s', 'now') AS INTEGER) * 1000)`,
  // Progress is per person, not per card, so a deck shared with everyone still
  // tracks each student separately. The old table kept one row per card.
  `CREATE TABLE IF NOT EXISTS card_progress_v2 (
    owner_sub TEXT NOT NULL,
    card_id TEXT NOT NULL,
    deck_id TEXT NOT NULL,
    correct INTEGER NOT NULL DEFAULT 0,
    incorrect INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    mastery INTEGER NOT NULL DEFAULT 0,
    next_due INTEGER,
    last_seen INTEGER,
    PRIMARY KEY (owner_sub, card_id)
  )`,
  `CREATE INDEX IF NOT EXISTS progress_v2_deck ON card_progress_v2(owner_sub, deck_id)`,
]

// Columns added after the first deploy. `CREATE TABLE IF NOT EXISTS` cannot
// widen a table that already exists, so each one is added only when missing.
const COLUMNS: [name: string, type: string][] = [
  ['file_name', 'TEXT'],
  ['file_size', 'INTEGER'],
  ['file_type', 'TEXT'],
]

async function migrate(db: D1Database) {
  const cardInfo = await db.prepare(`PRAGMA table_info(cards)`).all<{ name: string }>()
  const cardColumns = new Set(cardInfo.results.map((row) => row.name))
  for (const [name, type] of COLUMNS) {
    if (!cardColumns.has(name)) await db.prepare(`ALTER TABLE cards ADD COLUMN ${name} ${type}`).run()
  }

  // A shared deck belongs to the class library rather than to one person.
  const deckInfo = await db.prepare(`PRAGMA table_info(decks)`).all<{ name: string }>()
  if (!deckInfo.results.some((row) => row.name === 'shared')) {
    await db.prepare(`ALTER TABLE decks ADD COLUMN shared INTEGER NOT NULL DEFAULT 0`).run()
  }

  // One-time copy of the old single-row-per-card progress into the per-user table.
  const copied = await db.prepare(`SELECT COUNT(*) AS n FROM card_progress_v2`).first<{ n: number }>()
  if (!Number(copied?.n)) {
    await db.prepare(`INSERT OR IGNORE INTO card_progress_v2 (owner_sub, card_id, deck_id, correct, incorrect, streak, mastery, next_due, last_seen)
      SELECT owner_sub, card_id, deck_id, correct, incorrect, streak, mastery, next_due, last_seen FROM card_progress`).run()
  }
}

let ready: Promise<void> | undefined

export function ensureSchema(db: D1Database): Promise<void> {
  ready ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).then(
    () => migrate(db),
    (error) => {
      ready = undefined
      throw error
    },
  )
  return ready
}

export const requireDb: MiddlewareHandler<AppContext> = async (c, next) => {
  const db = c.env.DB
  if (!db) {
    return c.json({ error: 'database_missing', message: 'No database is attached yet. Add D1 storage named DB and redeploy.' }, 503)
  }
  await ensureSchema(db)
  c.set('db', db)
  await next()
}

export const id = () => crypto.randomUUID()
export const now = () => Date.now()

/** The role comes from the database, never from a request or a hardcoded list. */
export async function roleFor(db: D1Database, user: FreebuffUser): Promise<Role> {
  const email = user.email?.trim().toLowerCase()
  if (!email) return 'student'
  const row = await db.prepare(`SELECT role FROM roles WHERE email = ?`).bind(email).first<{ role: string }>()
  return row?.role === 'admin' ? 'admin' : 'student'
}

export const loadRole: MiddlewareHandler<AppContext> = async (c, next) => {
  c.set('role', await roleFor(c.get('db'), c.get('user')))
  await next()
}

/** Content changes are the admin's alone; students read and study what is published. */
export const requireAdmin: MiddlewareHandler<AppContext> = async (c, next) => {
  if (c.get('role') !== 'admin') {
    return c.json({ error: 'admin_required', message: 'Only the site admin can add, change or remove library content.' }, 403)
  }
  await next()
}

export function hueFor(text: string): number {
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
}

type Row = Record<string, unknown>

export const DECK_SELECT = `
  SELECT d.*,
    (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id AND c.owner_sub = d.owner_sub) AS card_count,
    (SELECT COUNT(*) FROM card_progress_v2 p WHERE p.deck_id = d.id AND p.owner_sub = ? AND p.mastery >= 80) AS mastered,
    (SELECT COALESCE(AVG(COALESCE(p.mastery, 0)), 0) FROM cards c LEFT JOIN card_progress_v2 p ON p.card_id = c.id AND p.owner_sub = ? WHERE c.deck_id = d.id AND c.owner_sub = d.owner_sub) AS mastery,
    (SELECT COUNT(*) FROM cards c LEFT JOIN card_progress_v2 p ON p.card_id = c.id AND p.owner_sub = ? WHERE c.deck_id = d.id AND c.owner_sub = d.owner_sub AND (p.next_due IS NULL OR p.next_due <= ?)) AS due_count
  FROM decks d`

export function mapDeck(r: Row) {
  return {
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string | null) ?? null,
    hue: Number(r.hue ?? 250),
    cardCount: Number(r.card_count ?? 0),
    mastered: Number(r.mastered ?? 0),
    mastery: Math.round(Number(r.mastery ?? 0)),
    dueCount: Number(r.due_count ?? 0),
    lastStudiedAt: r.last_studied_at === null || r.last_studied_at === undefined ? null : Number(r.last_studied_at),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }
}

export const CARD_SELECT = `
  SELECT c.*, p.correct, p.incorrect, p.streak, p.mastery, p.next_due, p.last_seen
  FROM cards c LEFT JOIN card_progress_v2 p ON p.card_id = c.id AND p.owner_sub = ?`

export function mapCard(r: Row) {
  return {
    id: r.id as string,
    deckId: r.deck_id as string,
    term: r.term as string,
    definition: r.definition as string,
    // A row stored before attachments recorded their type is assumed to be an image.
    hasImage: Boolean(r.image_key) && (!r.file_type || String(r.file_type).startsWith('image/')),
    fileName: (r.file_name as string | null) ?? null,
    fileSize: Number(r.file_size ?? 0),
    fileType: (r.file_type as string | null) ?? null,
    position: Number(r.position ?? 0),
    progress: {
      correct: Number(r.correct ?? 0),
      incorrect: Number(r.incorrect ?? 0),
      streak: Number(r.streak ?? 0),
      mastery: Number(r.mastery ?? 0),
      nextDue: r.next_due === null || r.next_due === undefined ? null : Number(r.next_due),
      lastSeen: r.last_seen === null || r.last_seen === undefined ? null : Number(r.last_seen),
    },
  }
}

export function mapSession(r: Row) {
  const total = Number(r.total)
  const score = Number(r.score)
  return {
    id: r.id as string,
    deckId: r.deck_id as string,
    deckTitle: (r.deck_title as string | undefined) ?? undefined,
    mode: r.mode as 'flashcards' | 'learn' | 'match',
    score,
    total,
    accuracy: total ? Math.round((score / total) * 100) : 0,
    durationMs: Number(r.duration_ms ?? 0),
    createdAt: Number(r.created_at),
  }
}

/** Consecutive days with at least one session, ending today or yesterday. */
export function streakFrom(days: Set<string>): { current: number; longest: number } {
  const key = (d: Date) => d.toISOString().slice(0, 10)
  const cursor = new Date()
  cursor.setUTCHours(0, 0, 0, 0)
  if (!days.has(key(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1)
  let current = 0
  while (days.has(key(cursor))) {
    current++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    if (previous) {
      const prev = new Date(previous)
      prev.setUTCDate(prev.getUTCDate() + 1)
      run = key(prev) === day ? run + 1 : 1
    } else run = 1
    longest = Math.max(longest, run)
    previous = day
  }
  return { current, longest: Math.max(longest, current) }
}
