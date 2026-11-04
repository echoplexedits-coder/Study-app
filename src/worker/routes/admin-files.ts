import { Hono } from 'hono'

import { privateJson } from '../auth'
import { logAudit, requireAdmin } from '../db'
import { signatureOk } from '../files'
import type { AppContext } from '../env'
import { MAX_ATTACHMENT_BYTES } from '../../shared/types'

export const adminFiles = new Hono<AppContext>()

// Classwork is class material, not a general file host. The allowlist is the one
// card attachments already use, so an uploaded .html or .svg can never come back
// from this origin as active content. No route serves these objects today; the
// allowlist keeps that true if one is added.
const ALLOWED_TYPES = new Set([
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
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

const MAX_MB = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))

/** One R2 key segment: no separators, no control characters, no `..` runs. */
function segment(value: unknown, fallback: string): string {
  const clean = String(value ?? '')
    .replace(/[\\/]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\.{2,}/g, '.')
    .trim()
    .slice(0, 80)
  return clean || fallback
}

adminFiles.get('/admin/files', requireAdmin, async (c) => {
  if (!c.env.FILES) {
    return c.json({ error: 'storage_missing', message: 'No file storage is attached yet.' }, 503)
  }
  const files: { name: string; size: number; contentType: string | null; uploadedAt: number }[] = []
  let cursor: string | undefined
  while (true) {
    const result = cursor ? await c.env.FILES.list({ cursor }) : await c.env.FILES.list()
    for (const entry of result.objects) {
      files.push({
        name: entry.key,
        size: entry.size,
        contentType: entry.httpMetadata?.contentType ?? null,
        uploadedAt: entry.uploaded.getTime(),
      })
    }
    if (!result.truncated) break
    cursor = result.cursor
  }
  return privateJson(c, { files })
})

adminFiles.post('/admin/files', requireAdmin, async (c) => {
  if (!c.env.FILES) {
    return c.json({ error: 'storage_missing', message: 'No file storage is attached yet.' }, 503)
  }
  const form = await c.req.formData()
  const file = form.get('file') as File | null
  const name = segment(form.get('name'), 'Classwork')
  const class_ = segment(form.get('class'), 'Unsorted')
  const subject = segment(form.get('subject'), 'General')
  const date = segment(form.get('date'), 'undated')
  if (!file) return c.json({ error: 'Invalid request.', message: 'file is required.' }, 400)
  const type = file.type || 'application/octet-stream'
  if (!ALLOWED_TYPES.has(type)) {
    return c.json({ error: 'unsupported_type', message: 'Upload a PDF, Word, PowerPoint, Excel, text, CSV, Markdown, EPUB or an image.' }, 415)
  }
  if (file.size <= 0) return c.json({ error: 'empty_file', message: 'That file looks empty.' }, 400)
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return c.json({ error: 'file_too_large', message: `Files are limited to ${MAX_MB} MB.` }, 413)
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (!signatureOk(type, head)) {
    return c.json({ error: 'invalid_signature', message: 'That file does not contain what its type says it does. Re-export it and try again.' }, 415)
  }
  const key = `${class_}/${subject}/${date}/${name}-${crypto.randomUUID()}`
  await c.env.FILES.put(key, file, { httpMetadata: { contentType: type } })
  await logAudit(c.get('db'), c.get('user'), 'classwork.upload', key, `${file.size} bytes ${type}`)
  return privateJson(c, { ok: true, file: { name, size: file.size, type, class: class_, subject, date } })
})

// R2 keys contain slashes (class/subject/date/name), so the whole tail of the
// path is the key. A single :name segment would only ever match flat keys.
adminFiles.delete('/admin/files/*', requireAdmin, async (c) => {
  if (!c.env.FILES) {
    return c.json({ error: 'storage_missing', message: 'No file storage is attached yet.' }, 503)
  }
  const raw = c.req.path.slice('/api/admin/files/'.length)
  let name = raw
  try {
    name = decodeURIComponent(raw)
  } catch {
    /* keep the raw value */
  }
  if (!name) return c.json({ error: 'Invalid request.', message: 'file name is required.' }, 400)
  // head() checks existence without downloading the object.
  const exists = await c.env.FILES.head(name)
  if (!exists) return c.json({ error: 'Not found.' }, 404)
  await c.env.FILES.delete(name)
  await logAudit(c.get('db'), c.get('user'), 'classwork.delete', name)
  return privateJson(c, { ok: true })
})
