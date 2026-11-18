import type { FreebuffUser } from '@freebuff/auth'
import type { Context } from 'hono'

import { ensureSchema, now } from './db'
import type { AppContext } from './env'
import { isReservedUsername, normalizeUsername, usernameProblem } from '../shared/identity'

const encoder = new TextEncoder()

export function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export async function sha256(value: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
}

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/**
 * The database is the final authority, so every public auth handler fetches it
 * itself instead of relying on middleware ordering.
 */
export async function dbFor(c: Context<AppContext>): Promise<D1Database | null> {
  const db = c.env.DB
  if (!db) return null
  await ensureSchema(db)
  return db
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

// PBKDF2-HMAC-SHA256 at the OWASP floor for this construction. The count is
// stored with every hash, so a later increase can re-encode old hashes on the
// next successful sign-in instead of locking anyone out.
const ITERATIONS = 600_000

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
  return new Uint8Array(bits)
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2-sha256$${ITERATIONS}$${b64url(salt)}$${b64url(hash)}`
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations < 10_000 || iterations > 5_000_000) return false
  try {
    const actual = await derive(password, fromB64url(parts[2]), iterations)
    return equal(actual, fromB64url(parts[3]))
  } catch {
    return false
  }
}

/** True when a stored hash was produced with a weaker setting than today's. */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  return parts[0] !== 'pbkdf2-sha256' || Number(parts[1]) < ITERATIONS
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export const SESSION_TTL_MS = 30 * 86_400_000
const SESSION_COOKIE = 'myclassroom_session'

function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

function cookieName(request: Request): string {
  // The __Host- prefix pins the cookie to this exact origin and requires Secure,
  // which browsers only allow over https.
  return isHttps(request) ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return null
}

function cookieValue(name: string, value: string, request: Request, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(request) ? '; Secure' : ''}`
}

export function sessionCookie(request: Request, token: string): string {
  return cookieValue(cookieName(request), token, request, Math.floor(SESSION_TTL_MS / 1000))
}

export function clearedSessionCookie(request: Request): string {
  return cookieValue(cookieName(request), '', request, 0)
}

/** True when the request carries a session cookie, whether or not it resolves. */
export function hasSessionCookie(request: Request): boolean {
  return Boolean(readCookie(request, cookieName(request)))
}

/** Creates a server-side session and returns the raw token for the cookie. */
export async function createSession(db: D1Database, sub: string, request: Request): Promise<string> {
  const token = randomToken()
  const t = now()
  await db.batch([
    // Expired rows are swept on a normal sign-in instead of needing a cron.
    db.prepare(`DELETE FROM auth_sessions WHERE token_hash IN (SELECT token_hash FROM auth_sessions WHERE expires_at < ?)`).bind(t),
    db
      .prepare(`INSERT INTO auth_sessions (token_hash, owner_sub, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)`)
      .bind(await sha256(token), sub, t, t + SESSION_TTL_MS, (request.headers.get('user-agent') ?? '').slice(0, 180)),
  ])
  return token
}

export async function revokeSession(db: D1Database, request: Request): Promise<void> {
  const token = readCookie(request, cookieName(request))
  if (!token) return
  await db.prepare(`DELETE FROM auth_sessions WHERE token_hash = ?`).bind(await sha256(token)).run()
}

export async function revokeAllSessions(db: D1Database, sub: string): Promise<void> {
  await db.prepare(`DELETE FROM auth_sessions WHERE owner_sub = ?`).bind(sub).run()
}

export interface AccountRow {
  owner_sub: string
  username: string | null
  username_key: string | null
  student_id: string | null
  full_name: string | null
  email: string | null
  email_key: string | null
  status: string
  password_hash: string | null
  username_updated_at: number | null
  seeded_at: number | null
  created_at: number
}

const ACCOUNT_COLUMNS = `owner_sub, username, username_key, student_id, full_name, email, email_key, status, password_hash, username_updated_at, seeded_at, created_at`

export async function accountFor(db: D1Database, sub: string): Promise<AccountRow | null> {
  return (await db.prepare(`SELECT ${ACCOUNT_COLUMNS} FROM users WHERE owner_sub = ?`).bind(sub).first<AccountRow>()) ?? null
}

export type EmailConflict = 'password' | 'provider' | 'role'

/**
 * Why an address cannot be used for a new password account. Provider-created
 * accounts and role addresses must never be claimable by password sign-up:
 * registration does not verify that the person owns the address.
 */
export async function emailConflict(db: D1Database, email: string): Promise<EmailConflict | null> {
  const normal = email.trim().toLowerCase()
  const account = await db
    .prepare(`SELECT password_hash FROM users WHERE email_key = ? LIMIT 1`)
    .bind(normal)
    .first<{ password_hash: string | null }>()
  if (account) return account.password_hash ? 'password' : 'provider'
  const role = await db.prepare(`SELECT 1 AS n FROM roles WHERE lower(email) = ? LIMIT 1`).bind(normal).first<{ n: number }>()
  return role ? 'role' : null
}

/** Resolves a session cookie to the account behind it. */
/**
 * Maps a provider identity onto an existing account only when that is provably
 * safe. A Google address that collides with a password account is deliberately
 * *not* merged: registration never verifies an address, so whoever typed it
 * first could otherwise inherit the Google owner's account. Returning null
 * keeps the request signed out; the OAuth callback explains the collision.
 */
export async function resolveIdentity(db: D1Database, user: FreebuffUser): Promise<FreebuffUser | null> {
  if (!user.sub.startsWith('google:')) return user
  const link = await db.prepare(`SELECT owner_sub FROM identity_links WHERE provider_sub = ?`).bind(user.sub).first<{ owner_sub: string }>()
  if (link) return { ...user, sub: link.owner_sub }
  // An account already created for this provider id owns its data; never
  // re-point an existing identity at a different row.
  const own = await db.prepare(`SELECT owner_sub FROM users WHERE owner_sub = ?`).bind(user.sub).first<{ owner_sub: string }>()
  if (own) return user
  const email = user.email?.trim().toLowerCase()
  if (!email || user.email_verified !== true) return user
  const existing = await db
    .prepare(`SELECT owner_sub, password_hash FROM users WHERE email_key = ? LIMIT 1`)
    .bind(email)
    .first<{ owner_sub: string; password_hash: string | null }>()
  if (!existing) return user
  if (existing.password_hash) return null
  await db
    .prepare(`INSERT INTO identity_links (provider_sub, owner_sub, created_at) VALUES (?, ?, ?) ON CONFLICT(provider_sub) DO NOTHING`)
    .bind(user.sub, existing.owner_sub, now())
    .run()
  const stored = await db.prepare(`SELECT owner_sub FROM identity_links WHERE provider_sub = ?`).bind(user.sub).first<{ owner_sub: string }>()
  return stored ? { ...user, sub: stored.owner_sub } : user
}

export async function sessionAccount(db: D1Database, request: Request): Promise<AccountRow | null> {
  const token = readCookie(request, cookieName(request))
  if (!token) return null
  const hash = await sha256(token)
  // Every user column is qualified: owner_sub and created_at exist on both
  // tables, and an unqualified name makes SQLite reject the whole query.
  const row = await db
    .prepare(
      `SELECT s.expires_at, u.owner_sub, u.username, u.username_key, u.student_id, u.full_name, u.email, u.email_key,
              u.status, u.password_hash, u.username_updated_at, u.seeded_at, u.created_at
       FROM auth_sessions s JOIN users u ON u.owner_sub = s.owner_sub WHERE s.token_hash = ?`,
    )
    .bind(hash)
    .first<AccountRow & { expires_at: number }>()
  if (!row) return null
  if (row.expires_at < now()) {
    await db.prepare(`DELETE FROM auth_sessions WHERE token_hash = ?`).bind(hash).run()
    return null
  }
  return row
}

// ---------------------------------------------------------------------------
// Student IDs
// ---------------------------------------------------------------------------

/**
 * A permanent, sequential, human-readable identity: MC-2026-000124. It is
 * allocated with a single UPDATE ... RETURNING so two simultaneous sign-ups
 * can never receive the same number.
 */
export async function nextStudentId(db: D1Database): Promise<string> {
  const year = new Date().getUTCFullYear()
  const row = await db
    .prepare(
      `INSERT INTO counters (name, value) VALUES ('student_id', 1)
       ON CONFLICT(name) DO UPDATE SET value = value + 1
       RETURNING value`,
    )
    .first<{ value: number }>()
  if (!row) throw new Error('student id counter unavailable')
  return `MC-${year}-${String(Number(row.value)).padStart(6, '0')}`
}

// ---------------------------------------------------------------------------
// Username reservations
// ---------------------------------------------------------------------------

/** How long a released name stays out of circulation. */
export const RELEASE_COOLDOWN_MS = 90 * 86_400_000

export type AvailabilityState = 'available' | 'taken' | 'reserved' | 'invalid'

export interface Availability {
  state: AvailabilityState
  message: string
  suggestions: string[]
}

export class UsernameTakenError extends Error {
  constructor() {
    super('Username already taken.')
    this.name = 'UsernameTakenError'
  }
}

const STATE_MESSAGE: Record<AvailabilityState, string> = {
  available: 'Username available!',
  taken: 'Username already taken. Try another.',
  reserved: 'That username is reserved for the platform.',
  invalid: 'That username cannot be used.',
}

/**
 * One read answers "can this be claimed right now?". A name is still held when
 * a reservation row points at an owner, or was released less than the cooldown
 * ago (so a deleted account's name cannot be grabbed immediately).
 */
export async function checkUsername(db: D1Database, raw: string): Promise<Availability & { username: string }> {
  const username = normalizeUsername(raw)
  const problem = usernameProblem(username)
  if (problem) return { username, state: isReservedUsername(username) ? 'reserved' : 'invalid', message: problem, suggestions: [] }

  const row = await db.prepare(`SELECT owner_sub, released_at FROM username_reservations WHERE name = ?`).bind(username).first<{ owner_sub: string | null; released_at: number | null }>()
  const held = row ? row.owner_sub !== null || Number(row.released_at ?? 0) > now() - RELEASE_COOLDOWN_MS : false
  if (!held) return { username, state: 'available', message: STATE_MESSAGE.available, suggestions: [] }
  return { username, state: 'taken', message: STATE_MESSAGE.taken, suggestions: await suggestUsernames(db, username) }
}

/** Two or three genuinely free variants, checked against the same rules. */
export async function suggestUsernames(db: D1Database, base: string): Promise<string[]> {
  const stem = base.replace(/[^a-z0-9_]/g, '').slice(0, 14) || 'student'
  const candidates = [
    `${stem}${Math.floor(Math.random() * 90 + 10)}`,
    `${stem}_${Math.floor(Math.random() * 900 + 100)}`,
    `${stem}${new Date().getUTCFullYear().toString().slice(2)}`,
  ]
  const out: string[] = []
  for (const candidate of candidates) {
    if (candidate.length > 20 || usernameProblem(candidate)) continue
    const row = await db.prepare(`SELECT owner_sub, released_at FROM username_reservations WHERE name = ?`).bind(candidate).first<{ owner_sub: string | null; released_at: number | null }>()
    const held = row ? row.owner_sub !== null || Number(row.released_at ?? 0) > now() - RELEASE_COOLDOWN_MS : false
    if (!held && !out.includes(candidate)) out.push(candidate)
    if (out.length === 3) break
  }
  return out
}

/**
 * Claims a name for an account. The reservation primary key is the lock: two
 * simultaneous registrations race on one INSERT and exactly one wins, so the
 * check-then-write gap cannot produce a duplicate.
 */
export async function claimUsername(db: D1Database, sub: string, raw: string, startCooldown = true): Promise<void> {
  const username = normalizeUsername(raw)
  const existing = await db.prepare(`SELECT owner_sub, released_at FROM username_reservations WHERE name = ?`).bind(username).first<{ owner_sub: string | null; released_at: number | null }>()
  if (existing) {
    const mine = existing.owner_sub === sub
    if (!mine) throw new UsernameTakenError()
  }
  const t = now()
  try {
    await db.batch([
      existing
        ? db.prepare(`UPDATE username_reservations SET owner_sub = ?, released_at = NULL WHERE name = ?`).bind(sub, username)
        : db.prepare(`INSERT INTO username_reservations (name, owner_sub, created_at) VALUES (?, ?, ?)`).bind(username, sub, t),
      /**
       * The first name a person chooses (onboarding, or at sign-up) is not a
       * change, so it leaves username_updated_at NULL and does not start the
       * 30-day cooldown. Every later change does.
       */
      db.prepare(`UPDATE users SET username = ?, username_key = ?, username_updated_at = ? WHERE owner_sub = ?`).bind(username, username, startCooldown ? t : null, sub),
    ])
  } catch (error) {
    // A unique constraint fired between the read and the write.
    if (String((error as Error)?.message ?? error).toLowerCase().includes('unique')) throw new UsernameTakenError()
    throw error
  }
}

/** Frees the previous name but keeps it reserved for the cooldown window. */
export async function releaseUsername(db: D1Database, raw: string, sub: string): Promise<void> {
  await db.prepare(`UPDATE username_reservations SET owner_sub = NULL, released_at = ? WHERE name = ? AND owner_sub = ?`).bind(now(), normalizeUsername(raw), sub).run()
}

// ---------------------------------------------------------------------------
// Throttling
// ---------------------------------------------------------------------------

/**
 * Per-isolate, memory-only limiter for the type-ahead endpoint: a database
 * write per keystroke would be worse than the abuse it prevents. Rare,
 * security-sensitive actions (sign-in, registration) use the durable limiter.
 */
const recentChecks = new Map<string, { count: number; resetAt: number }>()

export function checkBurst(key: string, limit = 40, windowMs = 60_000): boolean {
  const t = now()
  const entry = recentChecks.get(key)
  if (!entry || entry.resetAt < t) {
    if (recentChecks.size > 5_000) recentChecks.clear()
    recentChecks.set(key, { count: 1, resetAt: t + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count += 1
  return true
}

export function clientKey(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
}

export async function rateLimit(db: D1Database, key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfter: number }> {
  const t = now()
  const row = await db.prepare(`SELECT count, window_start FROM login_attempts WHERE key = ?`).bind(key).first<{ count: number; window_start: number }>()
  if (!row || t - Number(row.window_start) > windowMs) {
    await db
      .prepare(`INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`)
      .bind(key, t)
      .run()
    return { ok: true, retryAfter: 0 }
  }
  if (Number(row.count) >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((Number(row.window_start) + windowMs - t) / 1000)) }
  await db.prepare(`UPDATE login_attempts SET count = count + 1 WHERE key = ?`).bind(key).run()
  return { ok: true, retryAfter: 0 }
}

export async function clearRateLimit(db: D1Database, key: string): Promise<void> {
  await db.prepare(`DELETE FROM login_attempts WHERE key = ?`).bind(key).run()
}

// ---------------------------------------------------------------------------
// Password resets
// ---------------------------------------------------------------------------

export const RESET_TTL_MS = 30 * 60_000

export async function mintResetToken(db: D1Database, sub: string, issuedBy: string | null): Promise<string> {
  const token = randomToken()
  const t = now()
  // A new link supersedes every older unused one: a link handed out earlier
  // cannot still be redeemed after the person asks for another.
  await db.batch([
    db.prepare(`UPDATE password_resets SET used_at = ? WHERE owner_sub = ? AND used_at IS NULL`).bind(t, sub),
    db
      .prepare(`INSERT INTO password_resets (token_hash, owner_sub, created_at, expires_at, issued_by) VALUES (?, ?, ?, ?, ?)`)
      .bind(await sha256(token), sub, t, t + RESET_TTL_MS, issuedBy),
  ])
  return token
}
