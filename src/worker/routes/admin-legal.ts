import { Hono } from 'hono'
import type { Context } from 'hono'

import { privateJson } from '../auth'
import { logAudit, now, requireAdmin } from '../db'
import type { AppContext } from '../env'

type Row = Record<string, unknown>
const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')

async function body(c: Context<AppContext>): Promise<Row | null> {
  try {
    const parsed: unknown = await c.req.json()
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Row) : null
  } catch {
    return null
  }
}

/** The moderation inboxes for reports, contact messages and data requests. */
export const adminLegal = new Hono<AppContext>()

adminLegal.get('/admin/reports', requireAdmin, async (c) => {
  const status = c.req.query('status') ?? 'all'
  const query =
    status === 'open' || status === 'resolved'
      ? c.get('db').prepare(`SELECT * FROM content_reports WHERE status = ? ORDER BY created_at DESC LIMIT 100`).bind(status)
      : c.get('db').prepare(`SELECT * FROM content_reports ORDER BY created_at DESC LIMIT 100`)
  const rows = await query.all<Row>()
  return privateJson(c, { reports: rows.results })
})

adminLegal.patch('/admin/reports/:id', requireAdmin, async (c) => {
  const db = c.get('db')
  const input = await body(c)
  if (!input) return c.json({ error: 'invalid_body', message: 'Send a JSON object.' }, 400)
  const status = text(input.status, 20)
  if (status !== 'open' && status !== 'resolved') return c.json({ error: 'invalid_status', message: 'status must be open or resolved.' }, 400)
  const id = c.req.param('id')
  const resolution = text(input.resolution, 1000) || null
  const result = await db
    .prepare(`UPDATE content_reports SET status = ?, resolution = ?, resolved_at = ? WHERE id = ?`)
    .bind(status, resolution, status === 'resolved' ? now() : null, id)
    .run()
  if (!result.meta.changes) return c.json({ error: 'Not found.' }, 404)
  await logAudit(db, c.get('user'), 'report.resolve', id, status)
  return privateJson(c, { ok: true })
})

adminLegal.get('/admin/messages', requireAdmin, async (c) => {
  const rows = await c.get('db').prepare(`SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100`).all<Row>()
  return privateJson(c, { messages: rows.results })
})

adminLegal.patch('/admin/messages/:id', requireAdmin, async (c) => {
  const db = c.get('db')
  const input = await body(c)
  const status = text(input?.status, 20)
  if (status !== 'new' && status !== 'read' && status !== 'closed') {
    return c.json({ error: 'invalid_status', message: 'status must be new, read or closed.' }, 400)
  }
  const id = c.req.param('id')
  const result = await db.prepare(`UPDATE contact_messages SET status = ? WHERE id = ?`).bind(status, id).run()
  if (!result.meta.changes) return c.json({ error: 'Not found.' }, 404)
  await logAudit(db, c.get('user'), 'message.status', id, status)
  return privateJson(c, { ok: true })
})

adminLegal.get('/admin/requests', requireAdmin, async (c) => {
  const rows = await c.get('db').prepare(`SELECT * FROM data_requests ORDER BY created_at DESC LIMIT 100`).all<Row>()
  return privateJson(c, { requests: rows.results })
})

adminLegal.patch('/admin/requests/:id', requireAdmin, async (c) => {
  const db = c.get('db')
  const input = await body(c)
  const status = text(input?.status, 20)
  if (status !== 'open' && status !== 'resolved') return c.json({ error: 'invalid_status', message: 'status must be open or resolved.' }, 400)
  const id = c.req.param('id')
  const result = await db
    .prepare(`UPDATE data_requests SET status = ?, resolved_at = ? WHERE id = ?`)
    .bind(status, status === 'resolved' ? now() : null, id)
    .run()
  if (!result.meta.changes) return c.json({ error: 'Not found.' }, 404)
  await logAudit(db, c.get('user'), 'data.resolve', id, status)
  return privateJson(c, { ok: true })
})
