import { Hono } from 'hono'

import type { AppContext } from '../env'
import { isLibraryObject } from './notes'
import type { PublicLibrary } from '../../shared/types'

export const publicRoutes = new Hono<AppContext>()

const UUID_TAIL = /-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseKey(key: string) {
  const parts = key.split('/')
  const stored = parts.pop() ?? key
  const date = parts.length >= 3 ? (parts.pop() ?? '') : ''
  const subject = parts.length >= 2 ? (parts.pop() ?? '') : ''
  const className = parts.join('/') || 'Unsorted'
  return {
    name: stored.replace(UUID_TAIL, '') || 'Untitled',
    className,
    subject: subject === 'General' ? '' : subject,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
  }
}

/**
 * A tiny, public window onto the library for the landing page: how much real
 * material exists and the three most recent documents. It carries no keys, no
 * sizes and no way to download anything — the library itself stays behind
 * sign-in. Only classwork files are counted, never private card attachments.
 */
publicRoutes.get('/public/library', async (c) => {
  const empty: PublicLibrary = { notes: 0, subjects: 0, classes: 0, recent: [] }
  if (!c.env.FILES) {
    c.header('Cache-Control', 'public, max-age=30')
    return c.json(empty)
  }

  const subjects = new Set<string>()
  const classes = new Set<string>()
  const recent: PublicLibrary['recent'] = []
  let notes = 0
  let cursor: string | undefined
  while (true) {
    const page = cursor
      ? await c.env.FILES.list({ cursor, include: ['httpMetadata'] })
      : await c.env.FILES.list({ include: ['httpMetadata'] })
    for (const entry of page.objects) {
      if (isLibraryObject(entry.key)) continue
      const meta = parseKey(entry.key)
      notes += 1
      if (meta.subject) subjects.add(meta.subject.toLowerCase())
      classes.add(meta.className.toLowerCase())
      recent.push({
        name: meta.name,
        className: meta.className,
        subject: meta.subject,
        contentType: entry.httpMetadata?.contentType ?? null,
        uploadedAt: entry.uploaded.getTime(),
      })
    }
    if (!page.truncated) break
    cursor = page.cursor
  }

  recent.sort((a, b) => b.uploadedAt - a.uploadedAt)
  c.header('Cache-Control', 'public, max-age=60')
  return c.json<PublicLibrary>({
    notes,
    subjects: subjects.size,
    classes: classes.size,
    recent: recent.slice(0, 3),
  })
})
