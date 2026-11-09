import { Hono } from 'hono'
import type { Context } from 'hono'

import { privateJson } from '../auth'
import { logAudit, requireAdmin, now } from '../db'
import type { AppContext } from '../env'
import { RESET_TTL_MS, mintResetToken } from '../identity'
import type { AccountStatus, AdminUser, AdminUsersResponse, ResetRequest } from '../../shared/types'

export const adminUsers = new Hono<AppContext>()

// Every route here is admin-only. requireAdmin is attached per route, never as
// `use('*')`: this sub-app is mounted at /api, so a wildcard middleware would
// also wrap every route registered after it and lock students out of the
// library. Guarding each path keeps the blast radius to these four endpoints.

const PAGE_SIZE = 40
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

async function readJson(c: Context<AppContext>): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await c.req.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * The roster. Passwords and session tokens are never selected, so they cannot
 * leak through this endpoint even by accident.
 */
adminUsers.get('/admin/users', requireAdmin, async (c) => {
  const db = c.get('db')
  const q = text(c.req.query('q'), 60).toLowerCase()
  const page = Math.max(0, Math.min(500, Math.floor(Number(c.req.query('page') ?? 0) || 0)))

  const [rows, counts] = await Promise.all([
    db
      .prepare(
        `SELECT u.owner_sub, u.username, u.full_name, u.email, u.student_id, u.status, u.created_at,
           (u.password_hash IS NOT NULL) AS has_password,
           COALESCE((SELECT r.role FROM roles r WHERE lower(r.email) = u.email_key LIMIT 1), 'student') AS role
         FROM users u
         WHERE ? = ''
            OR instr(lower(COALESCE(u.username, '')), ?) > 0
            OR instr(lower(COALESCE(u.full_name, '')), ?) > 0
            OR instr(lower(COALESCE(u.email, '')), ?) > 0
            OR instr(lower(COALESCE(u.student_id, '')), ?) > 0
         ORDER BY u.created_at DESC
         LIMIT ${PAGE_SIZE} OFFSET ?`,
      )
      .bind(q, q, q, q, q, page * PAGE_SIZE)
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT COUNT(*) AS total,
           SUM(CASE WHEN u.status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
           SUM(CASE WHEN COALESCE((SELECT r.role FROM roles r WHERE lower(r.email) = u.email_key LIMIT 1), 'student') = 'admin' THEN 1 ELSE 0 END) AS admins
         FROM users u`,
      )
      .first<{ total: number; suspended: number | null; admins: number | null }>(),
  ])

  const total = Number(counts?.total ?? 0)
  const admins = Number(counts?.admins ?? 0)
  const body: AdminUsersResponse = {
    users: rows.results.map((row): AdminUser => ({
      sub: String(row.owner_sub),
      username: (row.username as string | null) ?? null,
      fullName: (row.full_name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      studentId: (row.student_id as string | null) ?? null,
      status: ((row.status as string | null) ?? 'active') as AccountStatus,
      role: row.role === 'admin' ? 'admin' : 'student',
      hasPassword: Boolean(row.has_password),
      createdAt: Number(row.created_at),
    })),
    counts: { total, admins, students: Math.max(0, total - admins), suspended: Number(counts?.suspended ?? 0) },
    page,
    pageSize: PAGE_SIZE,
  }
  return privateJson(c, body)
})

adminUsers.post('/admin/users/:sub/status', requireAdmin, async (c) => {
  const db = c.get('db')
  const actor = c.get('user')
  const target = c.req.param('sub')
  const body = await readJson(c)
  const status = body?.status === 'suspended' ? 'suspended' : body?.status === 'active' ? 'active' : null
  if (!status) return c.json({ error: 'status_invalid', message: 'Status must be active or suspended.' }, 400)
  if (target === actor.sub) return c.json({ error: 'cannot_target_self', message: 'You cannot suspend your own account.' }, 400)

  const row = await db.prepare(`SELECT owner_sub, username, student_id, status FROM users WHERE owner_sub = ?`).bind(target).first<{ owner_sub: string; username: string | null; student_id: string | null; status: string }>()
  if (!row) return c.json({ error: 'not_found', message: 'That account does not exist.' }, 404)

  await db.prepare(`UPDATE users SET status = ? WHERE owner_sub = ?`).bind(status, target).run()
  // Sessions are deliberately left alone: loadRole refuses every request for a
  // suspended account with a 403 the UI can explain, which is clearer than
  // silently signing the person out. A blocked login covers the next attempt.
  await logAudit(db, actor, `account.${status === 'suspended' ? 'suspend' : 'restore'}`, target, row.username ? `@${row.username}` : row.student_id)
  return privateJson(c, { ok: true, status })
})

/** Open "forgot password" requests, for when no email provider is configured. */
adminUsers.get('/admin/reset-requests', requireAdmin, async (c) => {
  const db = c.get('db')
  const rows = await db
    .prepare(
      `SELECT r.id, r.owner_sub, r.identifier, r.status, r.created_at, u.username, u.student_id
       FROM reset_requests r LEFT JOIN users u ON u.owner_sub = r.owner_sub
       WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 50`,
    )
    .all<Record<string, unknown>>()
  const body: { requests: ResetRequest[] } = {
    requests: rows.results.map((row) => ({
      id: String(row.id),
      sub: (row.owner_sub as string | null) ?? null,
      identifier: String(row.identifier),
      username: (row.username as string | null) ?? null,
      studentId: (row.student_id as string | null) ?? null,
      status: String(row.status),
      createdAt: Number(row.created_at),
    })),
  }
  return privateJson(c, body)
})

/**
 * Mints a single-use reset link to hand to the student. The token is returned
 * once, expires, and cannot be re-read from the database (only its hash is
 * stored), so the admin must pass it on now.
 */
adminUsers.post('/admin/reset-requests/:id/link', requireAdmin, async (c) => {
  const db = c.get('db')
  const actor = c.get('user')
  const id = c.req.param('id')
  const row = await db.prepare(`SELECT id, owner_sub, identifier FROM reset_requests WHERE id = ?`).bind(id).first<{ id: string; owner_sub: string | null; identifier: string }>()
  if (!row || !row.owner_sub) return c.json({ error: 'not_found', message: 'That request no longer exists.' }, 404)

  const token = await mintResetToken(db, row.owner_sub, actor.sub)
  await db.prepare(`UPDATE reset_requests SET status = 'resolved', resolved_at = ? WHERE id = ?`).bind(now(), id).run()
  await logAudit(db, actor, 'account.password.link', row.owner_sub, row.identifier)
  return privateJson(c, { ok: true, path: `/reset?token=${encodeURIComponent(token)}`, expiresInMinutes: Math.round(RESET_TTL_MS / 60_000) })
})
