import { Hono } from 'hono'
import type { Context } from 'hono'

import { privateJson } from '../auth'
import { logAudit, now } from '../db'
import type { AppContext } from '../env'
import {
  UsernameTakenError,
  accountFor,
  claimUsername,
  createSession,
  hashPassword,
  releaseUsername,
  revokeAllSessions,
  sessionCookie,
  verifyPassword,
} from '../identity'
import { normalizeUsername, passwordProblem, usernameProblem } from '../../shared/identity'
import type { Profile } from '../../shared/types'

export const profile = new Hono<AppContext>()

type Row = Record<string, unknown>
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
/** A username can be changed once every 30 days. */
const CHANGE_COOLDOWN_MS = 30 * 86_400_000

async function readJson(c: Context<AppContext>): Promise<Row | null> {
  try {
    const parsed: unknown = await c.req.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : null
  } catch {
    return null
  }
}

profile.get('/profile', async (c) => {
  const account = await accountFor(c.get('db'), c.get('user').sub)
  if (!account) return c.json({ error: 'not_found', message: 'This account has not been set up yet. Reload the page.' }, 404)
  const body: Profile = {
    sub: account.owner_sub,
    fullName: account.full_name,
    username: account.username,
    studentId: account.student_id,
    email: account.email,
    role: c.get('role'),
    status: (account.status as Profile['status']) ?? 'active',
    hasPassword: Boolean(account.password_hash),
    createdAt: account.created_at,
    usernameChangedAt: account.username_updated_at,
  }
  return privateJson(c, body)
})

/** Only the display name is editable here; identity fields are read-only. */
profile.patch('/profile', async (c) => {
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)
  const fullName = text(body.fullName, 80)
  if (fullName.length < 2) return c.json({ error: 'name_invalid', message: 'Enter your full name.' }, 400)
  const db = c.get('db')
  const user = c.get('user')
  await db.prepare(`UPDATE users SET full_name = ? WHERE owner_sub = ?`).bind(fullName, user.sub).run()
  await logAudit(db, user, 'account.profile.update', user.sub)
  return privateJson(c, { ok: true, fullName })
})

/**
 * A username change is a reservation move, never a new account: the internal id
 * and the student id stay exactly as they were, and the old name goes back into
 * the pool only after the cooldown.
 */
profile.post('/profile/username', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)

  const account = await accountFor(db, user.sub)
  if (!account) return c.json({ error: 'not_found', message: 'This account has not been set up yet. Reload the page.' }, 404)

  const username = normalizeUsername(text(body.username, 40))
  const issue = usernameProblem(username)
  if (issue) return c.json({ error: 'username_invalid', message: issue }, 400)

  if (username === account.username_key) {
    return c.json({ error: 'username_unchanged', message: 'That is already your username.' }, 400)
  }
  const lastChange = Number(account.username_updated_at ?? 0)
  if (account.username_key && lastChange && now() - lastChange < CHANGE_COOLDOWN_MS) {
    const days = Math.ceil((CHANGE_COOLDOWN_MS - (now() - lastChange)) / 86_400_000)
    return c.json({ error: 'username_cooldown', message: `Usernames can change once every 30 days. Try again in ${days} ${days === 1 ? 'day' : 'days'}.` }, 429)
  }

  try {
    // A first name (onboarding) does not start the change cooldown; a real
    // change does.
    await claimUsername(db, user.sub, username, Boolean(account.username_key))
  } catch (error) {
    if (error instanceof UsernameTakenError) {
      return c.json({ error: 'username_taken', message: 'Username already taken. Please choose another.' }, 409)
    }
    throw error
  }
  if (account.username_key) await releaseUsername(db, account.username_key, user.sub)
  await logAudit(db, user, 'account.username.change', user.sub, `${account.username_key ?? '—'} → ${username}`)
  return privateJson(c, { ok: true, username })
})

/**
 * Sets or replaces the password. An account that already has one must prove it
 * first; an OAuth account may add one, which then works alongside the provider.
 */
profile.post('/profile/password', async (c) => {
  const db = c.get('db')
  const user = c.get('user')
  const body = await readJson(c)
  if (!body) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)

  const account = await accountFor(db, user.sub)
  if (!account) return c.json({ error: 'not_found', message: 'This account has not been set up yet. Reload the page.' }, 404)

  if (account.password_hash) {
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    if (!current) return c.json({ error: 'current_required', message: 'Enter your current password.' }, 400)
    if (!(await verifyPassword(current, account.password_hash))) {
      return c.json({ error: 'current_invalid', message: 'That current password is not right.' }, 403)
    }
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const confirm = typeof body.confirmPassword === 'string' ? body.confirmPassword : password
  if (password !== confirm) return c.json({ error: 'password_mismatch', message: 'The two passwords do not match.' }, 400)
  const issue = passwordProblem(password, { username: account.username_key ?? undefined, email: account.email_key ?? undefined, name: account.full_name ?? undefined })
  if (issue) return c.json({ error: 'password_invalid', message: issue }, 400)

  const hash = await hashPassword(password)
  try {
    await db.prepare(`UPDATE users SET password_hash = ? WHERE owner_sub = ?`).bind(hash, user.sub).run()
  } catch {
    // The unique email index only applies to accounts with a password.
    return c.json({ error: 'email_conflict', message: 'Another password account already uses this email address.' }, 409)
  }
  // Changing a password signs every device out, including this one, then hands
  // the current browser a fresh session so the person is not thrown out of the
  // settings page they are standing on.
  await revokeAllSessions(db, user.sub)
  const token = await createSession(db, user.sub, c.req.raw)
  c.header('Set-Cookie', sessionCookie(c.req.raw, token))
  await logAudit(db, user, 'account.password.change', user.sub, account.password_hash ? 'changed' : 'created')
  return privateJson(c, { ok: true })
})
