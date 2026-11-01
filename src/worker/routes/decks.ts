import { Hono } from 'hono'

import { privateJson } from '../auth'
import { CARD_SELECT, DECK_SELECT, hueFor, id, mapCard, mapDeck, mapSession, now, requireAdmin } from '../db'
import type { AppContext } from '../env'
import type { SessionResult, StudyMode } from '../../shared/types'
import { MAX_ATTACHMENT_BYTES } from '../../shared/types'

export const decks = new Hono<AppContext>()

// The library belongs to the admin. Students may read it and record their own
// study sessions, which write nothing but their own progress.
decks.use('*', async (c, next) => {
  const method = c.req.method
  if (method === 'GET' || method === 'HEAD') return next()
  if (method === 'POST' && c.req.path.endsWith('/sessions')) return next()
  return requireAdmin(c, next)
})

const MODES = new Set<StudyMode>(['flashcards', 'learn', 'match'])
const DAY = 86_400_000

decks.get('/', async (c) => {
  const owner = c.get('user').sub
  const rows = await c.get('db').prepare(`${DECK_SELECT} WHERE d.owner_sub = ? OR d.shared = 1 ORDER BY COALESCE(d.last_studied_at, d.updated_at) DESC`).bind(owner, owner, owner, now(), owner).all()
  return privateJson(c, { items: (rows.results as Record<string, unknown>[]).map(mapDeck) })
})

decks.post('/', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const input = await c.req.json<{ title?: string; description?: string; cards?: { term: string; definition: string }[] }>()
  const title = input.title?.trim().slice(0, 80)
  if (!title) return c.json({ error: 'Give the deck a title.' }, 400)
  const deckId = id()
  const t = now()
  const statements = [
    db
      .prepare(`INSERT INTO decks (id, owner_sub, title, description, hue, shared, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(deckId, owner, title, input.description?.trim().slice(0, 300) || null, hueFor(title), t, t),
  ]
  cleanCards(input.cards).forEach((card, i) => {
    statements.push(
      db.prepare(`INSERT INTO cards (id, owner_sub, deck_id, term, definition, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id(), owner, deckId, card.term, card.definition, i, t + i),
    )
  })
  for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40))
  const row = await db.prepare(`${DECK_SELECT} WHERE d.id = ?`).bind(owner, owner, owner, t, deckId).first()
  return privateJson(c, { deck: mapDeck(row as Record<string, unknown>) }, 201)
})

decks.get('/:id', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const deckId = c.req.param('id')
  const [deck, cards, sessions] = await db.batch([
    db.prepare(`${DECK_SELECT} WHERE d.id = ? AND (d.owner_sub = ? OR d.shared = 1)`).bind(owner, owner, owner, now(), deckId, owner),
    db.prepare(`${CARD_SELECT} WHERE c.deck_id = ? ORDER BY c.position ASC, c.created_at ASC`).bind(owner, deckId),
    db.prepare(`SELECT * FROM sessions WHERE owner_sub = ? AND deck_id = ? ORDER BY created_at DESC LIMIT 10`).bind(owner, deckId),
  ])
  if (!deck.results[0]) return c.json({ error: 'Not found.' }, 404)
  return privateJson(c, {
    deck: mapDeck(deck.results[0] as Record<string, unknown>),
    cards: (cards.results as Record<string, unknown>[]).map(mapCard),
    sessions: (sessions.results as Record<string, unknown>[]).map(mapSession),
  })
})

decks.patch('/:id', async (c) => {
  const db = c.get('db')
  const deckId = c.req.param('id')
  const input = await c.req.json<{ title?: string; description?: string | null }>()
  const existing = await db.prepare(`SELECT * FROM decks WHERE id = ?`).bind(deckId).first<Record<string, unknown>>()
  if (!existing) return c.json({ error: 'Not found.' }, 404)
  const title = (input.title ?? (existing.title as string)).trim().slice(0, 80)
  if (!title) return c.json({ error: 'Give the deck a title.' }, 400)
  const description = input.description === undefined ? (existing.description as string | null) : input.description?.trim().slice(0, 300) || null
  await db.prepare(`UPDATE decks SET title = ?, description = ?, updated_at = ? WHERE id = ?`).bind(title, description, now(), deckId).run()
  return privateJson(c, { ok: true })
})

decks.delete('/:id', async (c) => {
  const db = c.get('db')
  const deckId = c.req.param('id')
  const deck = await db.prepare(`SELECT id FROM decks WHERE id = ?`).bind(deckId).first()
  if (!deck) return c.json({ error: 'Not found.' }, 404)
  const keys = await db.prepare(`SELECT image_key FROM cards WHERE deck_id = ? AND image_key IS NOT NULL`).bind(deckId).all<{ image_key: string }>()
  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE deck_id = ?`).bind(deckId),
    db.prepare(`DELETE FROM card_progress_v2 WHERE deck_id = ?`).bind(deckId),
    db.prepare(`DELETE FROM cards WHERE deck_id = ?`).bind(deckId),
    db.prepare(`DELETE FROM decks WHERE id = ?`).bind(deckId),
  ])
  if (c.env.FILES && keys.results.length) await c.env.FILES.delete(keys.results.map((r) => r.image_key))
  return privateJson(c, { ok: true })
})

// Cards

function cleanCards(input: { term?: string; definition?: string }[] | undefined) {
  return (input ?? [])
    .map((card) => ({ term: card.term?.trim().slice(0, 300) ?? '', definition: card.definition?.trim().slice(0, 600) ?? '' }))
    .filter((card) => card.term && card.definition)
    .slice(0, 500)
}

decks.post('/:id/cards', async (c) => {
  const db = c.get('db')
  const deckId = c.req.param('id')
  const deck = await db.prepare(`SELECT owner_sub FROM decks WHERE id = ?`).bind(deckId).first<{ owner_sub: string }>()
  if (!deck) return c.json({ error: 'Not found.' }, 404)
  const input = await c.req.json<{ cards?: { term: string; definition: string }[] }>()
  const cards = cleanCards(input.cards)
  if (cards.length === 0) return c.json({ error: 'Each card needs a term and a definition.' }, 400)
  const top = await db.prepare(`SELECT COALESCE(MAX(position), -1) AS p FROM cards WHERE deck_id = ?`).bind(deckId).first<{ p: number }>()
  const t = now()
  const statements = cards.map((card, i) =>
    db
      .prepare(`INSERT INTO cards (id, owner_sub, deck_id, term, definition, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id(), deck.owner_sub, deckId, card.term, card.definition, (top?.p ?? -1) + 1 + i, t + i),
  )
  statements.push(db.prepare(`UPDATE decks SET updated_at = ? WHERE id = ?`).bind(t, deckId))
  for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40))
  return privateJson(c, { added: cards.length }, 201)
})

decks.patch('/:id/cards/:cardId', async (c) => {
  const db = c.get('db')
  const input = await c.req.json<{ term?: string; definition?: string }>()
  const [card] = cleanCards([{ term: input.term, definition: input.definition }])
  if (!card) return c.json({ error: 'Each card needs a term and a definition.' }, 400)
  const result = await db
    .prepare(`UPDATE cards SET term = ?, definition = ? WHERE id = ? AND deck_id = ?`)
    .bind(card.term, card.definition, c.req.param('cardId'), c.req.param('id'))
    .run()
  if (!result.meta.changes) return c.json({ error: 'Not found.' }, 404)
  return privateJson(c, { ok: true })
})

decks.delete('/:id/cards/:cardId', async (c) => {
  const db = c.get('db')
  const cardId = c.req.param('cardId')
  const existing = await db.prepare(`SELECT image_key FROM cards WHERE id = ? AND deck_id = ?`).bind(cardId, c.req.param('id')).first<{ image_key: string | null }>()
  if (!existing) return c.json({ error: 'Not found.' }, 404)
  await db.batch([
    db.prepare(`DELETE FROM card_progress_v2 WHERE card_id = ?`).bind(cardId),
    db.prepare(`DELETE FROM cards WHERE id = ?`).bind(cardId),
  ])
  if (existing.image_key && c.env.FILES) await c.env.FILES.delete(existing.image_key)
  return privateJson(c, { ok: true })
})

// Card attachments (R2): one image or document per card, replaced on upload.
// The upload body is streamed straight into R2, so a large file is never held
// in the Worker's memory and the only real ceiling is the platform's request
// body limit (100 MB), which MAX_ATTACHMENT_BYTES stays under.

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/rtf',
  'application/epub+zip',
  'text/plain',
  'text/csv',
  'text/markdown',
])
const ATTACHMENT_TYPES = new Set([...IMAGE_TYPES, ...DOCUMENT_TYPES])
const MAX_ATTACHMENT_MB = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))

/** A path-free, printable, header-safe filename. */
function safeFileName(raw: string | undefined): string {
  let value = raw ?? ''
  try {
    value = decodeURIComponent(value)
  } catch {
    /* keep the raw value */
  }
  const clean = value
    .replace(/[\\/]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120)
  return clean || 'attachment'
}

decks.put('/:id/cards/:cardId/file', async (c) => {
  const bucket = c.env.FILES
  if (!bucket) return c.json({ error: 'storage_missing', message: 'No file storage is attached yet. Add R2 storage named FILES and redeploy.' }, 503)
  const db = c.get('db')
  const owner = c.get('user').sub
  const cardId = c.req.param('cardId')
  const existing = await db.prepare(`SELECT image_key FROM cards WHERE id = ? AND deck_id = ?`).bind(cardId, c.req.param('id')).first<{ image_key: string | null }>()
  if (!existing) return c.json({ error: 'Not found.' }, 404)

  const type = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!ATTACHMENT_TYPES.has(type)) {
    return c.json({ error: 'unsupported_type', message: 'Attach an image (PNG, JPEG, WebP, GIF) or a PDF, Word, PowerPoint, Excel, text, CSV, Markdown or EPUB file.' }, 415)
  }
  const size = Number(c.req.header('content-length') ?? 0)
  if (!Number.isFinite(size) || size <= 0) return c.json({ error: 'empty_file', message: 'That file looks empty.' }, 400)
  if (size > MAX_ATTACHMENT_BYTES) return c.json({ error: 'file_too_large', message: `Files are limited to ${MAX_ATTACHMENT_MB} MB.` }, 413)
  const body = c.req.raw.body
  if (!body) return c.json({ error: 'empty_file', message: 'That file looks empty.' }, 400)

  const name = safeFileName(c.req.header('x-file-name'))
  const key = `${owner}/cards/${cardId}/${crypto.randomUUID()}`
  try {
    await bucket.put(key, body, { httpMetadata: { contentType: type } })
  } catch (error) {
    console.error('attachment upload failed', error)
    return c.json({ error: 'storage_unavailable', message: 'Storage could not accept that file — the space allocated to this site may be full.' }, 507)
  }
  await db.prepare(`UPDATE cards SET image_key = ?, file_name = ?, file_size = ?, file_type = ? WHERE id = ?`).bind(key, name, size, type, cardId).run()
  if (existing.image_key) await bucket.delete(existing.image_key)
  return privateJson(c, { ok: true, file: { name, size, type } })
})

decks.delete('/:id/cards/:cardId/file', async (c) => {
  const db = c.get('db')
  const cardId = c.req.param('cardId')
  const existing = await db.prepare(`SELECT image_key FROM cards WHERE id = ? AND deck_id = ?`).bind(cardId, c.req.param('id')).first<{ image_key: string | null }>()
  if (!existing) return c.json({ error: 'Not found.' }, 404)
  await db.prepare(`UPDATE cards SET image_key = NULL, file_name = NULL, file_size = NULL, file_type = NULL WHERE id = ?`).bind(cardId).run()
  if (existing.image_key && c.env.FILES) await c.env.FILES.delete(existing.image_key)
  return privateJson(c, { ok: true })
})

decks.get('/:id/cards/:cardId/file', async (c) => {
  const bucket = c.env.FILES
  if (!bucket) return c.json({ error: 'Not found.' }, 404)
  const owner = c.get('user').sub
  const card = await c.get('db')
    .prepare(`SELECT c.image_key, c.file_name, c.file_type FROM cards c JOIN decks d ON d.id = c.deck_id WHERE c.id = ? AND c.deck_id = ? AND (d.owner_sub = ? OR d.shared = 1)`)
    .bind(c.req.param('cardId'), c.req.param('id'), owner)
    .first<{ image_key: string | null; file_name: string | null; file_type: string | null }>()
  if (!card?.image_key) return c.json({ error: 'Not found.' }, 404)
  const object = await bucket.get(card.image_key)
  if (!object) return c.json({ error: 'Not found.' }, 404)
  const type = object.httpMetadata?.contentType ?? card.file_type ?? 'application/octet-stream'
  const name = card.file_name ?? 'attachment'
  // Only images render inline. Everything else downloads, so a document can never
  // execute as a page on this origin.
  const disposition = type.startsWith('image/') ? 'inline' : 'attachment'
  // Header values must be latin-1: a filename like "Übersicht.pdf" would throw
  // when the Response is built, so only ASCII goes in the plain parameter and
  // the full name travels in the RFC 5987 form.
  const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '') || 'attachment'
  return new Response(object.body, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(object.size),
      'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

// Sessions: the client plays the round, the server records it and updates
// each card's mastery and due date (a light spaced-repetition schedule).

decks.post('/:id/sessions', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const deckId = c.req.param('id')
  const input = await c.req.json<{ mode?: StudyMode; results?: SessionResult[]; durationMs?: number }>()
  if (!input.mode || !MODES.has(input.mode)) return c.json({ error: 'Unknown study mode.' }, 400)
  const results = (input.results ?? []).filter((r) => typeof r.cardId === 'string' && typeof r.correct === 'boolean').slice(0, 500)
  if (results.length === 0) return c.json({ error: 'Nothing to record.' }, 400)
  const deck = await db.prepare(`SELECT id FROM decks WHERE id = ? AND (owner_sub = ? OR shared = 1)`).bind(deckId, owner).first()
  if (!deck) return c.json({ error: 'Not found.' }, 404)
  const ids = [...new Set(results.map((r) => r.cardId))]
  const owned = await db
    .prepare(`SELECT c.id, p.correct, p.incorrect, p.streak, p.mastery FROM cards c LEFT JOIN card_progress_v2 p ON p.card_id = c.id AND p.owner_sub = ? WHERE c.deck_id = ? AND c.id IN (${ids.map(() => '?').join(',')})`)
    .bind(owner, deckId, ...ids)
    .all<{ id: string; correct: number | null; incorrect: number | null; streak: number | null; mastery: number | null }>()
  const byId = new Map(owned.results.map((r) => [r.id, r]))

  const t = now()
  const statements: D1PreparedStatement[] = []
  let score = 0
  for (const r of results) {
    const row = byId.get(r.cardId)
    if (!row) continue
    if (r.correct) score++
    const correct = Number(row.correct ?? 0) + (r.correct ? 1 : 0)
    const incorrect = Number(row.incorrect ?? 0) + (r.correct ? 0 : 1)
    const streak = r.correct ? Number(row.streak ?? 0) + 1 : 0
    const previous = Number(row.mastery ?? 0)
    const mastery = r.correct ? Math.min(100, previous + Math.max(10, Math.round((100 - previous) * 0.35))) : Math.max(0, Math.round(previous * 0.5))
    const interval = r.correct ? Math.min(30, Math.pow(2, streak)) * DAY : 0
    statements.push(
      db
        .prepare(
          `INSERT INTO card_progress_v2 (owner_sub, card_id, deck_id, correct, incorrect, streak, mastery, next_due, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(owner_sub, card_id) DO UPDATE SET correct = excluded.correct, incorrect = excluded.incorrect, streak = excluded.streak, mastery = excluded.mastery, next_due = excluded.next_due, last_seen = excluded.last_seen`,
        )
        .bind(owner, r.cardId, deckId, correct, incorrect, streak, mastery, t + interval, t),
    )
    byId.set(r.cardId, { id: r.cardId, correct, incorrect, streak, mastery })
  }
  const total = results.filter((r) => byId.has(r.cardId)).length
  const sessionId = id()
  statements.push(
    db
      .prepare(`INSERT INTO sessions (id, owner_sub, deck_id, mode, score, total, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(sessionId, owner, deckId, input.mode, score, total, Math.max(0, Math.round(Number(input.durationMs) || 0)), t),
  )
  // The deck is not necessarily owned by the person studying it, so this must
  // match on id alone — otherwise a student's session never records.
  statements.push(db.prepare(`UPDATE decks SET last_studied_at = ?, updated_at = ? WHERE id = ?`).bind(t, t, deckId))
  for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40))
  return privateJson(c, { session: { id: sessionId, score, total, accuracy: total ? Math.round((score / total) * 100) : 0 } }, 201)
})
