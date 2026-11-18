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

// The Sites R2 allowance for this project is 1 GB. Keep this as a single
// server-side limit: the dashboard only reports it, and uploads are refused
// against the bytes actually present in the bucket.
const R2_LIMIT_BYTES = 1024 * 1024 * 1024
const R2_WARN_RATIO = 0.8

async function listObjects(bucket: R2Bucket): Promise<R2Object[]> {
  const objects: R2Object[] = []
  let cursor: string | undefined
  while (true) {
    const result = cursor
      ? await bucket.list({ cursor, include: ['httpMetadata'] })
      : await bucket.list({ include: ['httpMetadata'] })
    objects.push(...result.objects)
    if (!result.truncated) break
    cursor = result.cursor
  }
  return objects
}

function usageFor(objects: R2Object[]) {
  const bytes = objects.reduce((sum, object) => sum + object.size, 0)
  const remaining = Math.max(0, R2_LIMIT_BYTES - bytes)
  return {
    bytes,
    files: objects.length,
    limitBytes: R2_LIMIT_BYTES,
    remaining,
    percent: Math.round((bytes / R2_LIMIT_BYTES) * 1000) / 10,
    warning: bytes >= R2_LIMIT_BYTES * R2_WARN_RATIO,
    maxFileSize: MAX_ATTACHMENT_BYTES,
  }
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`
}

// Card attachments and deck covers also live in FILES, but they are not
// classwork. Their keys have a stable shape, so the admin file list can skip
// them instead of showing someone's private flashcard image as a handout.
const CARD_OBJECT = /^[^/]+\/cards\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i
const COVER_OBJECT = /^[^/]+\/decks\/[0-9a-f-]{36}\/cover\/[0-9a-f-]{36}$/i
const isLibraryObject = (key: string) => CARD_OBJECT.test(key) || COVER_OBJECT.test(key)

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
  const objects = await listObjects(c.env.FILES)
  const files = objects
    .filter((entry) => !isLibraryObject(entry.key))
    .map((entry) => ({
      name: entry.key,
      size: entry.size,
      contentType: entry.httpMetadata?.contentType ?? null,
      uploadedAt: entry.uploaded.getTime(),
    }))
  return privateJson(c, { files, usage: usageFor(objects) })
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
  const existing = await listObjects(c.env.FILES)
  const used = existing.reduce((sum, object) => sum + object.size, 0)
  if (used + file.size > R2_LIMIT_BYTES) {
    return c.json(
      {
        error: 'storage_full',
        message: `Not enough storage: ${sizeLabel(Math.max(0, R2_LIMIT_BYTES - used))} remains of the ${sizeLabel(R2_LIMIT_BYTES)} limit, but this file is ${sizeLabel(file.size)}. Delete a file first.`,
      },
      507,
    )
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
