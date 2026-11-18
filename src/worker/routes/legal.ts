import { isSameOriginRequest } from '@freebuff/auth'
import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'

import { appOrigin, privateJson } from '../auth'
import { adminRoleCount, id, isLastAdminChange, logAudit, now } from '../db'
import type { AppContext } from '../env'
import { CONTACT_TOPICS, POLICY_EFFECTIVE, POLICY_VERSION, REPORT_REASONS } from '../../shared/legal'

type Row = Record<string, unknown>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const REPORT_VALUES = new Set(REPORT_REASONS.map((option) => option.value))
const TOPIC_VALUES = new Set(CONTACT_TOPICS.map((option) => option.value))
const DAY = 86_400_000

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const flag = (value: unknown): boolean => value === true

async function body(c: Context<AppContext>): Promise<Row | null> {
  try {
    const parsed: unknown = await c.req.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : null
  } catch {
    return null
  }
}

export async function consentFor(db: D1Database, sub: string): Promise<{ policy_version: string; accepted_at: number; source: string } | null> {
  return (
    (await db
      .prepare(`SELECT policy_version, accepted_at, source FROM consents WHERE owner_sub = ? ORDER BY accepted_at DESC LIMIT 1`)
      .bind(sub)
      .first<{ policy_version: string; accepted_at: number; source: string }>()) ?? null
  )
}

/**
 * Content changes require a current acceptance. Reads, the legal endpoints and
 * the data-rights endpoints stay open, so someone who has not accepted can
 * still read the policies, export their data or delete their account.
 */
export const requireConsent: MiddlewareHandler<AppContext> = async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.path.startsWith('/api/legal/')) return next()
  // Identity steps are not content changes: claiming a username and setting a
  // password have to work before the consent screen can even be reached,
  // otherwise a new account would be stuck between the two gates.
  if (c.req.path.startsWith('/api/profile')) return next()
  const row = await consentFor(c.get('db'), c.get('user').sub)
  if (!row || row.policy_version !== POLICY_VERSION) {
    return c.json(
      {
        error: 'consent_required',
        message: `Accept the current Terms of Use, Privacy Policy and Acceptable Use Policy (version ${POLICY_VERSION}) before making changes.`,
      },
      403,
    )
  }
  await next()
}

export const legal = new Hono<AppContext>()

legal.get('/legal/status', async (c) => {
  const row = await consentFor(c.get('db'), c.get('user').sub)
  return privateJson(c, {
    version: POLICY_VERSION,
    effective: POLICY_EFFECTIVE,
    accepted: row?.policy_version === POLICY_VERSION,
    acceptedAt: row?.accepted_at ?? null,
    acceptedVersion: row?.policy_version ?? null,
  })
})

legal.post('/legal/consent', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const input = await body(c)
  if (!input) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)
  if (text(input.version, 20) !== POLICY_VERSION) {
    return c.json({ error: 'version_mismatch', message: 'These policies have changed. Reload the page and read the current version.' }, 409)
  }
  const missing: string[] = []
  if (!flag(input.terms)) missing.push('Terms of Use and Acceptable Use Policy')
  if (!flag(input.privacy)) missing.push('Privacy Policy')
  if (!flag(input.age)) missing.push('age or guardian confirmation')
  if (missing.length) {
    return c.json({ error: 'consent_incomplete', message: `Still to confirm: ${missing.join('; ')}. Every statement has to be actively agreed to.` }, 400)
  }
  const acceptedAt = now()
  await db
    .prepare(
      `INSERT INTO consents (owner_sub, policy_version, accepted_at, source) VALUES (?, ?, ?, ?)
       ON CONFLICT(owner_sub, policy_version) DO UPDATE SET accepted_at = excluded.accepted_at, source = excluded.source`,
    )
    .bind(user.sub, POLICY_VERSION, acceptedAt, 'consent_screen')
    .run()
  await logAudit(db, user, 'legal.consent', POLICY_VERSION)
  return privateJson(c, { ok: true, version: POLICY_VERSION, accepted: true, acceptedAt })
})

/** Everything the signed-in person contributed or that was recorded about them. */
legal.get('/legal/export', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const sub = user.sub
  const [decks, cards, progress, sessions, consents, reports, requests] = await db.batch([
    db.prepare(`SELECT * FROM decks WHERE owner_sub = ? ORDER BY created_at`).bind(sub),
    db.prepare(`SELECT * FROM cards WHERE owner_sub = ? ORDER BY deck_id, position`).bind(sub),
    db.prepare(`SELECT * FROM card_progress_v2 WHERE owner_sub = ?`).bind(sub),
    db.prepare(`SELECT * FROM sessions WHERE owner_sub = ? ORDER BY created_at`).bind(sub),
    db.prepare(`SELECT policy_version, accepted_at, source FROM consents WHERE owner_sub = ? ORDER BY accepted_at`).bind(sub),
    db.prepare(`SELECT id, kind, target_type, target_id, reason, details, status, created_at, resolved_at FROM content_reports WHERE reporter_sub = ? ORDER BY created_at`).bind(sub),
    db.prepare(`SELECT id, kind, details, status, created_at, resolved_at FROM data_requests WHERE owner_sub = ? ORDER BY created_at`).bind(sub),
  ])
  // Attachment bytes are not included: the export lists the file metadata, and
  // the file itself can be downloaded from the card it belongs to.
  c.header('content-disposition', `attachment; filename="myclassroom-my-data-${new Date().toISOString().slice(0, 10)}.json"`)
  return privateJson(c, {
    exportedAt: now(),
    policyVersion: POLICY_VERSION,
    account: { sub, name: user.name ?? null, email: user.email ?? null },
    consents: consents.results,
    decks: decks.results,
    cards: cards.results,
    progress: progress.results,
    sessions: sessions.results,
    reports: reports.results,
    dataRequests: requests.results,
  })
})

legal.post('/legal/deletion-request', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const input = await body(c)
  if (!input) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)
  const kind = text(input.kind, 30)
  if (kind !== 'delete_account' && kind !== 'delete_data') {
    return c.json({ error: 'invalid_kind', message: 'kind must be delete_account or delete_data.' }, 400)
  }
  const existing = await db
    .prepare(`SELECT id FROM data_requests WHERE owner_sub = ? AND kind = ? AND status = 'open' AND created_at > ?`)
    .bind(user.sub, kind, now() - 7 * DAY)
    .first<{ id: string }>()
  if (existing) return privateJson(c, { ok: true, duplicate: true })
  await db
    .prepare(`INSERT INTO data_requests (id, owner_sub, email, kind, details, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)`)
    .bind(id(), user.sub, user.email ?? null, kind, text(input.details, 1000) || null, now())
    .run()
  await logAudit(db, user, 'data.request', kind)
  return privateJson(c, { ok: true, duplicate: false }, 201)
})

legal.post('/legal/delete-account', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const role = c.get('role')
  const input = await body(c)
  if (text(input?.confirm, 20) !== 'DELETE') {
    return c.json({ error: 'confirm_required', message: 'Type DELETE to confirm that this removes the account and its content.' }, 400)
  }

  // The last admin cannot delete themselves out of the site; promote someone
  // first. This mirrors the guard on role changes and library restore.
  if (role === 'admin' && isLastAdminChange(role, await adminRoleCount(db))) {
    return c.json({ error: 'last_admin', message: 'This is the only admin account. Promote another admin before deleting it.' }, 409)
  }

  const sub = user.sub
  const email = user.email?.trim().toLowerCase() ?? null
  const keys = await db.prepare(`SELECT image_key FROM cards WHERE owner_sub = ? AND image_key IS NOT NULL`).bind(sub).all<{ image_key: string }>()
  const deckRows = await db.prepare(`SELECT id, cover_image_key FROM decks WHERE owner_sub = ?`).bind(sub).all<{ id: string; cover_image_key: string | null }>()
  const deckIds = deckRows.results.map((row) => row.id)
  const coverKeys = deckRows.results.flatMap((row) => (row.cover_image_key ? [row.cover_image_key] : []))
  const counts = {
    decks: deckIds.length,
    attachments: keys.results.length + coverKeys.length,
    sessions: Number((await db.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE owner_sub = ?`).bind(sub).first<{ n: number }>())?.n ?? 0),
  }

  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM card_progress_v2 WHERE owner_sub = ?`).bind(sub),
    db.prepare(`DELETE FROM sessions WHERE owner_sub = ?`).bind(sub),
    db.prepare(`DELETE FROM cards WHERE owner_sub = ?`).bind(sub),
    db.prepare(`DELETE FROM decks WHERE owner_sub = ?`).bind(sub),
    db.prepare(`DELETE FROM consents WHERE owner_sub = ?`).bind(sub),
    db.prepare(`DELETE FROM data_requests WHERE owner_sub = ?`).bind(sub),
    db.prepare(`DELETE FROM users WHERE owner_sub = ?`).bind(sub),
    // A moderation record is kept, but not the identity of the person who filed it.
    db.prepare(`UPDATE content_reports SET reporter_sub = NULL, reporter_email = NULL WHERE reporter_sub = ?`).bind(sub),
  ]
  if (email) statements.push(db.prepare(`DELETE FROM roles WHERE lower(email) = ?`).bind(email))
  // Other accounts may have studied these decks. Their progress and sessions
  // reference the deck by id and would otherwise survive the deletion.
  for (let i = 0; i < deckIds.length; i += 40) {
    const chunk = deckIds.slice(i, i + 40)
    const marks = chunk.map(() => '?').join(',')
    statements.push(
      db.prepare(`DELETE FROM card_progress_v2 WHERE deck_id IN (${marks})`).bind(...chunk),
      db.prepare(`DELETE FROM sessions WHERE deck_id IN (${marks})`).bind(...chunk),
    )
  }
  await db.batch(statements)

  const bucket = c.env.FILES
  const remove = keys.results.map((row) => row.image_key).concat(coverKeys)
  if (bucket && remove.length) {
    for (let i = 0; i < remove.length; i += 100) {
      try {
        await bucket.delete(remove.slice(i, i + 100))
      } catch (error) {
        console.error('account deletion: attachment cleanup failed', error)
      }
    }
  }

  await logAudit(db, user, 'account.delete', sub, `${counts.decks} decks, ${counts.attachments} attachments, ${counts.sessions} sessions`)
  // Security logs keep the action trail but drop the email address.
  await db.prepare(`UPDATE audit_log SET actor_email = NULL WHERE actor_sub = ?`).bind(sub).run()

  return privateJson(c, { ok: true, deleted: { decks: counts.decks, attachments: counts.attachments, sessions: counts.sessions } })
})

legal.post('/legal/report', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const sub = user.sub
  const input = await body(c)
  if (!input) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)

  const kind = text(input.kind, 20)
  if (kind !== 'content' && kind !== 'copyright') return c.json({ error: 'invalid_kind', message: 'kind must be content or copyright.' }, 400)
  const reason = text(input.reason, 40)
  if (!REPORT_VALUES.has(reason as never)) return c.json({ error: 'invalid_reason', message: 'Choose a reason from the list.' }, 400)
  const targetType = text(input.targetType, 20)
  if (!['deck', 'card', 'classwork', 'other'].includes(targetType)) {
    return c.json({ error: 'invalid_target', message: 'targetType must be deck, card, classwork or other.' }, 400)
  }
  const targetId = text(input.targetId, 200) || null
  const details = text(input.details, 4000)
  if (details.length < 10) return c.json({ error: 'details_required', message: 'Describe the problem in at least a sentence.' }, 400)
  if (!flag(input.goodFaith) || !flag(input.accuracyConfirmed)) {
    return c.json({ error: 'statements_required', message: 'Both the good-faith and accuracy statements have to be confirmed.' }, 400)
  }
  if (kind === 'copyright' && !flag(input.rightsHolder)) {
    return c.json({ error: 'rights_required', message: 'A copyright report needs confirmation that you own the work or act for the owner.' }, 400)
  }
  if (targetType === 'other' && !targetId) {
    return c.json({ error: 'target_required', message: 'Name the deck, card or file in the description, or give its link.' }, 400)
  }
  if (targetType === 'deck' && targetId) {
    const deck = await db.prepare(`SELECT id FROM decks WHERE id = ? AND (owner_sub = ? OR shared = 1)`).bind(targetId, sub).first()
    if (!deck) return c.json({ error: 'target_not_found', message: 'That deck is not in the library you can see.' }, 404)
  }
  if (targetType === 'card' && targetId) {
    const card = await db
      .prepare(`SELECT c.id FROM cards c JOIN decks d ON d.id = c.deck_id WHERE c.id = ? AND (d.owner_sub = ? OR d.shared = 1)`)
      .bind(targetId, sub)
      .first()
    if (!card) return c.json({ error: 'target_not_found', message: 'That card is not in the library you can see.' }, 404)
  }

  const recent = await db.prepare(`SELECT COUNT(*) AS n FROM content_reports WHERE reporter_sub = ? AND created_at > ?`).bind(sub, now() - DAY).first<{ n: number }>()
  if (Number(recent?.n ?? 0) >= 10) {
    return c.json({ error: 'rate_limited', message: 'You have sent several reports today. The administrator will review them before more can be filed.' }, 429)
  }

  const reportId = id()
  await db
    .prepare(
      `INSERT INTO content_reports (id, reporter_sub, reporter_email, kind, target_type, target_id, reason, details, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    )
    .bind(reportId, sub, user.email ?? null, kind, targetType, targetId, reason, details, now())
    .run()
  await logAudit(db, user, kind === 'copyright' ? 'report.copyright' : 'report.content', targetId ?? targetType, reason)
  return privateJson(c, { ok: true, id: reportId }, 201)
})

/**
 * The public Contact form. It sits outside the signed-in API so a rights holder
 * or parent can reach the operator without an account. There is no published
 * email address or phone number, because none exists to publish — the form is
 * the real channel and every message lands in the admin inbox.
 */
export async function contactHandler(c: Context<AppContext>) {
  const request = c.req.raw
  if (!isSameOriginRequest(request, appOrigin(c.env, request))) return c.json({ error: 'cross_origin', message: 'Cross-origin request refused.' }, 403)
  const db = c.env.DB
  if (!db) return c.json({ error: 'database_missing', message: 'No database is attached yet.' }, 503)
  const input = await body(c)
  if (!input) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)
  // Honeypot: a field no person fills in. Answer as if it worked.
  if (text(input.website, 100)) return privateJson(c, { ok: true })

  const email = text(input.email, 200).toLowerCase()
  const name = text(input.name, 120)
  const topic = text(input.topic, 30)
  const message = text(input.message, 4000)
  if (!EMAIL.test(email)) return c.json({ error: 'invalid_email', message: 'Enter an email address the operator can reply to.' }, 400)
  if (name.length < 2) return c.json({ error: 'invalid_name', message: 'Enter your name.' }, 400)
  if (!TOPIC_VALUES.has(topic as never)) return c.json({ error: 'invalid_topic', message: 'Choose a topic from the list.' }, 400)
  if (message.length < 20) return c.json({ error: 'message_too_short', message: 'Add a little more detail so the message can be answered.' }, 400)
  if (!flag(input.consent)) return c.json({ error: 'consent_required', message: 'Confirm that the message may be stored so it can be answered.' }, 400)

  const recent = await db.prepare(`SELECT COUNT(*) AS n FROM contact_messages WHERE lower(email) = ? AND created_at > ?`).bind(email, now() - DAY).first<{ n: number }>()
  if (Number(recent?.n ?? 0) >= 5) {
    return c.json({ error: 'rate_limited', message: 'Several messages have already been sent from this address today. Please wait for a reply.' }, 429)
  }
  // A global ceiling keeps a flood of different addresses from filling the table.
  const hour = await db.prepare(`SELECT COUNT(*) AS n FROM contact_messages WHERE created_at > ?`).bind(now() - 3_600_000).first<{ n: number }>()
  if (Number(hour?.n ?? 0) >= 200) {
    return c.json({ error: 'rate_limited', message: 'The contact form is receiving a lot of messages right now. Try again later.' }, 429)
  }

  await db
    .prepare(`INSERT INTO contact_messages (id, owner_sub, name, email, topic, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'new', ?)`)
    .bind(id(), null, name, email, topic, message, now())
    .run()
  return privateJson(c, { ok: true }, 201)
}
