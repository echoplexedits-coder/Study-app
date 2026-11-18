import { isSameOriginRequest } from '@freebuff/auth'
import { Hono } from 'hono'
import type { Context } from 'hono'

import { appOrigin, currentUser } from '../auth'
import { logAudit, now } from '../db'
import type { AppContext } from '../env'
import {
  UsernameTakenError,
  accountFor,
  checkBurst,
  checkUsername,
  clearRateLimit,
  clearedSessionCookie,
  clientKey,
  createSession,
  dbFor,
  emailConflict,
  hashPassword,
  mintResetToken,
  needsRehash,
  nextStudentId,
  rateLimit,
  revokeAllSessions,
  revokeSession,
  sessionAccount,
  sessionCookie,
  sha256,
  verifyPassword,
} from '../identity'
import { mailConfigured, sendResetEmail } from '../mail'
import { RESET_TTL_MS } from '../identity'
import { normalizeUsername, passwordProblem, usernameProblem } from '../../shared/identity'

// Public authentication surface: no session required, same-origin enforced on
// every mutation, and every rule re-checked against the database.
export const authRoutes = new Hono<AppContext>()

type Row = Record<string, unknown>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

async function readJson(c: Context<AppContext>): Promise<Row | null> {
  try {
    const parsed: unknown = await c.req.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : null
  } catch {
    return null
  }
}

function sameOrigin(c: Context<AppContext>): boolean {
  return isSameOriginRequest(c.req.raw, appOrigin(c.env, c.req.raw))
}

function noDatabase(c: Context<AppContext>) {
  return c.json({ error: 'database_missing', message: 'Accounts are not available yet — the database is not attached.' }, 503)
}

/**
 * Live availability. Debounced in the browser and throttled here per isolate,
 * so typing a name does not become a database write per keystroke.
 */
authRoutes.get('/auth/username', async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const db = await dbFor(c)
  if (!db) return noDatabase(c)
  if (!checkBurst(clientKey(c.req.raw), 150, 60_000)) {
    return c.json({ error: 'rate_limited', message: 'Too many checks just now. Wait a moment.' }, 429)
  }
  const raw = c.req.query('u') ?? ''
  const result = await checkUsername(db, raw)
  // One's own current name is not "taken" from one's own point of view.
  if (result.state === 'taken') {
    // Resolve the viewer exactly as every other route does, so a Google or
    // Freebuff account checking its own name is not told the name is taken.
    const viewer = await currentUser(c.env, c.req.raw, db)
    const account = viewer ? await accountFor(db, viewer.sub) : null
    if (account && account.username_key === result.username) {
      return c.json({ ...result, state: 'available', message: 'This is your current username.', own: true, suggestions: [] })
    }
  }
  return c.json({ ...result, own: false })
})

authRoutes.post('/auth/register', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'cross_origin', message: 'Cross-origin request refused.' }, 403)
  const db = await dbFor(c)
  if (!db) return noDatabase(c)
  const limited = await rateLimit(db, `register:${clientKey(c.req.raw)}`, 10, 3_600_000)
  if (!limited.ok) return c.json({ error: 'rate_limited', message: `Too many sign-up attempts. Try again in ${limited.retryAfter} seconds.` }, 429)

  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)

  const fullName = text(body.fullName, 80)
  const email = text(body.email, 160).toLowerCase()
  const username = normalizeUsername(text(body.username, 40))
  const password = typeof body.password === 'string' ? body.password : ''
  const confirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : password

  if (fullName.length < 2) return c.json({ error: 'name_invalid', message: 'Enter your full name.' }, 400)
  if (!EMAIL.test(email)) return c.json({ error: 'email_invalid', message: 'Enter a valid email address.' }, 400)
  const nameIssue = usernameProblem(username)
  if (nameIssue) return c.json({ error: 'username_invalid', message: nameIssue }, 400)
  const passwordIssue = passwordProblem(password, { username, email, name: fullName })
  if (passwordIssue) return c.json({ error: 'password_invalid', message: passwordIssue }, 400)
  if (password !== confirm) return c.json({ error: 'password_mismatch', message: 'The two passwords do not match.' }, 400)

  const conflict = await emailConflict(db, email)
  if (conflict) {
    return c.json(
      conflict === 'password'
        ? { error: 'email_taken', message: 'That email already has an account. Sign in instead, or use a different address.' }
        : {
            error: 'email_linked',
            message:
              conflict === 'role'
                ? 'That email is reserved for a site account. Sign in with that account instead.'
                : 'That email is already used by a Google or Freebuff account. Sign in with that provider instead.',
          },
      409,
    )
  }

  const sub = `local:${crypto.randomUUID()}`
  const studentId = await nextStudentId(db)
  const passwordHash = await hashPassword(password)
  const t = now()
  try {
    // Both writes in one batch: the reservation key is the lock, and the users
    // row is only created if the name was actually claimed.
    await db.batch([
      db.prepare(`INSERT INTO username_reservations (name, owner_sub, created_at) VALUES (?, ?, ?)`).bind(username, sub, t),
      db
        .prepare(
          `INSERT INTO users (owner_sub, created_at, full_name, username, username_key, email, email_key, student_id, status, password_hash, username_updated_at, onboarded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        )
        // username_updated_at stays NULL: choosing a name at sign-up is not a
        // change, so it must not start the 30-day change cooldown.
        .bind(sub, t, fullName, username, username, email, email, studentId, passwordHash, null, t),
    ])
  } catch {
    // The reservation or one of the unique indexes rejected the write. Say
    // which, without ever falling back to "try again" on a silent duplicate.
    const claim = await checkUsername(db, username)
    if (claim.state !== 'available') {
      return c.json({ error: 'username_taken', message: 'Username already taken. Please choose another.', suggestions: claim.suggestions }, 409)
    }
    const taken = await db.prepare(`SELECT 1 AS n FROM users WHERE email_key = ?`).bind(email).first<{ n: number }>()
    if (taken) return c.json({ error: 'email_taken', message: 'That email already has an account. Sign in instead.' }, 409)
    throw new Error('registration failed')
  }

  const token = await createSession(db, sub, c.req.raw)
  c.header('Set-Cookie', sessionCookie(c.req.raw, token))
  await logAudit(db, { sub, name: fullName, email, email_verified: true }, 'account.register', sub, `@${username} · ${studentId}`)
  return c.json({ ok: true, user: { sub, username, studentId, fullName, email } }, 201)
})

authRoutes.post('/auth/login', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'cross_origin', message: 'Cross-origin request refused.' }, 403)
  const db = await dbFor(c)
  if (!db) return noDatabase(c)
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)

  const identifier = normalizeUsername(text(body.identifier, 160))
  const password = typeof body.password === 'string' ? body.password : ''
  if (!identifier || !password) return c.json({ error: 'credentials_required', message: 'Enter your username and password.' }, 400)

  const ip = clientKey(c.req.raw)
  const byIp = await rateLimit(db, `login-ip:${ip}`, 20, 15 * 60_000)
  if (!byIp.ok) return c.json({ error: 'rate_limited', message: `Too many sign-in attempts. Try again in ${byIp.retryAfter} seconds.` }, 429)
  const byName = await rateLimit(db, `login-name:${identifier}`, 8, 15 * 60_000)
  if (!byName.ok) return c.json({ error: 'rate_limited', message: `Too many attempts for that account. Try again in ${byName.retryAfter} seconds.` }, 429)

  const row = await db
    .prepare(`SELECT owner_sub, username, status, password_hash, full_name, email FROM users WHERE (username_key = ? OR email_key = ?) AND password_hash IS NOT NULL`)
    .bind(identifier, identifier)
    .first<{ owner_sub: string; username: string; status: string; password_hash: string; full_name: string | null; email: string | null }>()

  if (!row) {
    // Spend the same work as a real check so response time does not reveal
    // whether the name exists.
    await hashPassword(password)
    return c.json({ error: 'invalid_credentials', message: 'That username and password do not match.' }, 401)
  }
  const ok = await verifyPassword(password, row.password_hash)
  if (!ok) return c.json({ error: 'invalid_credentials', message: 'That username and password do not match.' }, 401)
  if (row.status !== 'active') {
    return c.json({ error: 'account_suspended', message: 'This account is suspended. Ask the site admin to restore it.' }, 403)
  }

  if (needsRehash(row.password_hash)) {
    // The hash was made with an older setting; replace it now that we have the
    // plaintext in hand. Comparing against a literal count here would rewrite
    // every hash on every sign-in as soon as the cost is raised.
    const upgraded = await hashPassword(password)
    await db.prepare(`UPDATE users SET password_hash = ? WHERE owner_sub = ?`).bind(upgraded, row.owner_sub).run()
  }

  await clearRateLimit(db, `login-name:${identifier}`)
  const token = await createSession(db, row.owner_sub, c.req.raw)
  c.header('Set-Cookie', sessionCookie(c.req.raw, token))
  await logAudit(db, { sub: row.owner_sub, name: row.full_name ?? undefined, email: row.email ?? undefined, email_verified: true }, 'account.login', row.owner_sub)
  return c.json({ ok: true, user: { sub: row.owner_sub, username: row.username } })
})

authRoutes.post('/auth/logout', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'cross_origin', message: 'Cross-origin request refused.' }, 403)
  const db = await dbFor(c)
  if (db) await revokeSession(db, c.req.raw)
  c.header('Set-Cookie', clearedSessionCookie(c.req.raw))
  return c.json({ ok: true })
})

/** One open request per account, so repeated clicks cannot flood the queue. */
async function openResetRequest(db: D1Database, sub: string, identifier: string): Promise<void> {
  const open = await db.prepare(`SELECT id FROM reset_requests WHERE owner_sub = ? AND status = 'open'`).bind(sub).first<{ id: string }>()
  if (open) return
  await db
    .prepare(`INSERT INTO reset_requests (id, owner_sub, identifier, status, created_at) VALUES (?, ?, ?, 'open', ?)`)
    .bind(crypto.randomUUID(), sub, identifier, now())
    .run()
}

/**
 * Always the same answer, whether or not the account exists — the difference
 * is only in what the operator can do afterwards, never in the response.
 */
authRoutes.post('/auth/password/request', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'cross_origin', message: 'Cross-origin request refused.' }, 403)
  const db = await dbFor(c)
  if (!db) return noDatabase(c)
  const limited = await rateLimit(db, `reset-req:${clientKey(c.req.raw)}`, 6, 15 * 60_000)
  if (!limited.ok) return c.json({ error: 'rate_limited', message: `Too many requests. Try again in ${limited.retryAfter} seconds.` }, 429)

  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)
  const identifier = normalizeUsername(text(body.identifier, 160))
  if (!identifier) return c.json({ ok: true })

  const row = await db
    .prepare(`SELECT owner_sub, full_name, email, username FROM users WHERE (username_key = ? OR email_key = ?) AND password_hash IS NOT NULL AND status = 'active'`)
    .bind(identifier, identifier)
    .first<{ owner_sub: string; full_name: string | null; email: string | null; username: string | null }>()

  if (row) {
    if (mailConfigured(c.env) && row.email) {
      const token = await mintResetToken(db, row.owner_sub, 'self-serve')
      const link = `${appOrigin(c.env, c.req.raw)}/reset?token=${encodeURIComponent(token)}`
      const sent = await sendResetEmail(c.env, { to: row.email, name: row.full_name, link, minutes: Math.round(RESET_TTL_MS / 60_000) })
      // A provider that refuses the message must not leave the person waiting
      // on mail that will never arrive: queue it for an admin as well.
      if (!sent) await openResetRequest(db, row.owner_sub, row.username ?? identifier)
    } else {
      await openResetRequest(db, row.owner_sub, row.username ?? identifier)
    }
  }
  return c.json({ ok: true, mail: mailConfigured(c.env) })
})

authRoutes.post('/auth/password/reset', async (c) => {
  if (!sameOrigin(c)) return c.json({ error: 'cross_origin', message: 'Cross-origin request refused.' }, 403)
  const db = await dbFor(c)
  if (!db) return noDatabase(c)
  const limited = await rateLimit(db, `reset:${clientKey(c.req.raw)}`, 12, 3_600_000)
  if (!limited.ok) return c.json({ error: 'rate_limited', message: `Too many attempts. Try again in ${limited.retryAfter} seconds.` }, 429)

  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)
  const token = text(body.token, 200)
  const password = typeof body.password === 'string' ? body.password : ''
  const confirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : password
  if (!token) return c.json({ error: 'token_missing', message: 'This reset link is incomplete. Ask for a new one.' }, 400)
  if (password !== confirm) return c.json({ error: 'password_mismatch', message: 'The two passwords do not match.' }, 400)

  const row = await db
    .prepare(
      `SELECT r.owner_sub, r.expires_at, r.used_at, u.username_key, u.email_key, u.full_name
       FROM password_resets r JOIN users u ON u.owner_sub = r.owner_sub WHERE r.token_hash = ?`,
    )
    .bind(await sha256(token))
    .first<{ owner_sub: string; expires_at: number; used_at: number | null; username_key: string | null; email_key: string | null; full_name: string | null }>()

  if (!row || row.used_at || Number(row.expires_at) < now()) {
    return c.json({ error: 'token_invalid', message: 'This reset link has expired or was already used. Ask for a new one.' }, 400)
  }
  const issue = passwordProblem(password, { username: row.username_key ?? undefined, email: row.email_key ?? undefined, name: row.full_name ?? undefined })
  if (issue) return c.json({ error: 'password_invalid', message: issue }, 400)

  const hash = await hashPassword(password)
  const t = now()
  await db.batch([
    db.prepare(`UPDATE users SET password_hash = ? WHERE owner_sub = ?`).bind(hash, row.owner_sub),
    db.prepare(`UPDATE password_resets SET used_at = ? WHERE token_hash = ?`).bind(t, await sha256(token)),
    db.prepare(`UPDATE reset_requests SET status = 'resolved', resolved_at = ? WHERE owner_sub = ? AND status = 'open'`).bind(t, row.owner_sub),
  ])
  // A reset signs every other device out.
  await revokeAllSessions(db, row.owner_sub)
  await logAudit(db, { sub: row.owner_sub, email: row.email_key ?? undefined, email_verified: true }, 'account.password.reset', row.owner_sub)
  return c.json({ ok: true })
})

/** Used by the settings page after a username change to prove the new name. */
authRoutes.get('/auth/username/current', async (c) => {
  c.header('Cache-Control', 'private, no-store')
  const db = await dbFor(c)
  if (!db) return noDatabase(c)
  const account = await sessionAccount(db, c.req.raw)
  if (!account) return c.json({ error: 'Sign in required.' }, 401)
  return c.json({ username: account.username, studentId: account.student_id, usernameUpdatedAt: account.username_updated_at })
})

// Kept out of the response body on purpose: a claim conflict must look the same
// whether it came from the reservation key or the unique index.
export const CLAIM_CONFLICT = UsernameTakenError
