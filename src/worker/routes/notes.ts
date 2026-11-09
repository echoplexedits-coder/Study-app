import { Hono } from 'hono'

import { privateJson } from '../auth'
import type { AppContext } from '../env'
import type { NoteFile } from '../../shared/types'

export const notes = new Hono<AppContext>()

// Card attachments and deck covers also live in FILES, but they belong to one
// person's private study material. The notes library must never list or serve
// them, so both key shapes are excluded here as well as in the admin listing.
const CARD_OBJECT = /^[^/]+\/cards\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i
const COVER_OBJECT = /^[^/]+\/decks\/[0-9a-f-]{36}\/cover\/[0-9a-f-]{36}$/i
export const isLibraryObject = (key: string) => CARD_OBJECT.test(key) || COVER_OBJECT.test(key)

/** The upload route stamps keys as class/subject/date/name-uuid. */
const UUID_TAIL = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseKey(key: string): Pick<NoteFile, 'className' | 'subject' | 'date' | 'name'> {
  const parts = key.split('/')
  const stored = parts.pop() ?? key
  const date = parts.length >= 3 ? (parts.pop() ?? '') : ''
  const subject = parts.length >= 2 ? (parts.pop() ?? '') : ''
  const className = parts.join('/') || 'Unsorted'
  const name = stored.replace(UUID_TAIL, '') || 'Untitled'
  return {
    className,
    subject: subject === 'General' ? '' : subject,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    name,
  }
}

/** Keeps a filename safe inside a quoted Content-Disposition header. */
function headerSafe(value: string): string {
  return value.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'document'
}

// Shared deck selectors like the rest of the API: students read, the admin
// writes. Everything below is read-only, so a signed-in session is enough.
notes.get('/notes', async (c) => {
  if (!c.env.FILES) {
    return c.json({ error: 'storage_missing', message: 'No file storage is attached yet.' }, 503)
  }
  const files: NoteFile[] = []
  let cursor: string | undefined
  while (true) {
    // R2 omits object metadata from a listing unless it is asked for; without
    // this every document came back with a null content type.
    const page = cursor
      ? await c.env.FILES.list({ cursor, include: ['httpMetadata'] })
      : await c.env.FILES.list({ include: ['httpMetadata'] })
    for (const entry of page.objects) {
      if (isLibraryObject(entry.key)) continue
      files.push({
        key: entry.key,
        ...parseKey(entry.key),
        size: entry.size,
        contentType: entry.httpMetadata?.contentType ?? null,
        uploadedAt: entry.uploaded.getTime(),
      })
    }
    if (!page.truncated) break
    cursor = page.cursor
  }
  files.sort((a, b) => b.uploadedAt - a.uploadedAt)
  return privateJson(c, { files })
})

// R2 keys contain slashes, so the whole tail of the path is the object key.
// `?download=1` switches the disposition; the default is inline so the browser
// can show a PDF in its own viewer or a preview frame.
notes.on(['GET', 'HEAD'], '/notes/file/*', async (c) => {
  if (!c.env.FILES) {
    return c.json({ error: 'storage_missing', message: 'No file storage is attached yet.' }, 503)
  }
  const raw = c.req.path.slice('/api/notes/file/'.length)
  let key = raw
  try {
    key = decodeURIComponent(raw)
  } catch {
    /* keep the raw value */
  }
  // A private card attachment is never a class note, whoever asks for it.
  if (!key || isLibraryObject(key)) return c.json({ error: 'not_found', message: 'That document could not be found.' }, 404)

  const head = await c.env.FILES.head(key)
  if (!head) return c.json({ error: 'not_found', message: 'That document could not be found.' }, 404)

  const object = c.req.method === 'HEAD' ? null : await c.env.FILES.get(key)
  if (c.req.method !== 'HEAD' && !object) {
    return c.json({ error: 'not_found', message: 'That document could not be found.' }, 404)
  }

  const parsed = parseKey(key)
  const extension = /\.([a-z0-9]{1,8})$/i.exec(key)?.[1]?.toLowerCase() ?? ''
  const fallbackName = `${headerSafe(parsed.name)}${extension ? `.${extension}` : ''}`
  const disposition = c.req.query('download') === '1' ? 'attachment' : 'inline'

  const headers = new Headers({
    'content-type': head.httpMetadata?.contentType ?? 'application/octet-stream',
    'content-disposition': `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(parsed.name)}`,
    'content-length': String(head.size),
    'cache-control': 'private, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff',
  })
  if (head.etag) headers.set('etag', head.etag)
  return new Response(c.req.method === 'HEAD' ? null : object!.body, { status: 200, headers })
})
