import { Hono } from 'hono'

import { authMode, privateJson } from '../auth'
import { logAudit, mapSession, now, requireAdmin, streakFrom } from '../db'
import { googleConfigured } from '../google'
import type { AppContext } from '../env'
import { clearProgress, clearUser, seedUser } from '../seed'
import { MAX_ATTACHMENT_BYTES } from '../../shared/types'
import type { Me, Stats, Storage } from '../../shared/types'

export const account = new Hono<AppContext>()

/**
 * Removes a person's library and the R2 objects behind it. clearUser() only
 * touches the database, so without this every reset or clear left the old
 * images in storage with nothing pointing at them.
 */
async function clearOwned(db: D1Database, owner: string, bucket?: R2Bucket) {
  const keys = await db.prepare(`SELECT image_key FROM cards WHERE owner_sub = ? AND image_key IS NOT NULL`).bind(owner).all<{ image_key: string }>()
  await clearUser(db, owner)
  if (!bucket || keys.results.length === 0) return
  try {
    for (let i = 0; i < keys.results.length; i += 100) {
      await bucket.delete(keys.results.slice(i, i + 100).map((row) => row.image_key))
    }
  } catch (error) {
    console.error('library cleanup failed', error)
  }
}

async function sessionDays(db: D1Database, owner: string): Promise<Set<string>> {
  const rows = await db.prepare(`SELECT DISTINCT date(created_at / 1000, 'unixepoch') AS day FROM sessions WHERE owner_sub = ?`).bind(owner).all<{ day: string }>()
  return new Set(rows.results.map((r) => r.day))
}

account.get('/me', async (c) => {
  const user = c.get('user')
  const db = c.get('db')
  const role = c.get('role')
  let row = await db.prepare(`SELECT seeded_at FROM users WHERE owner_sub = ?`).bind(user.sub).first<{ seeded_at: number | null }>()
  if (!row) {
    await db.prepare(`INSERT INTO users (owner_sub, created_at) VALUES (?, ?)`).bind(user.sub, now()).run()
    // Only the admin gets a furnished library; students study what is published.
    if (role === 'admin') {
      await seedUser(db, user.sub)
      row = { seeded_at: now() }
    } else {
      row = { seeded_at: null }
    }
  }
  // Everything the admin owns is the class library. Doing it here also brings
  // decks created before roles existed into view for everyone.
  if (role === 'admin') {
    // Read first: an unconditional UPDATE would spend a write on every page load.
    const stale = await db.prepare(`SELECT COUNT(*) AS n FROM decks WHERE owner_sub = ? AND shared = 0`).bind(user.sub).first<{ n: number }>()
    if (Number(stale?.n)) await db.prepare(`UPDATE decks SET shared = 1 WHERE owner_sub = ? AND shared = 0`).bind(user.sub).run()
  }
  const body: Me = {
    user: { sub: user.sub, name: user.name, email: user.email, picture: user.picture },
    streak: streakFrom(await sessionDays(db, user.sub)).current,
    seeded: Boolean(row.seeded_at),
    capabilities: {
      database: true,
      files: Boolean(c.env.FILES),
      auth: user.sub.startsWith('google:') ? 'google' : authMode(c.env, c.req.raw) === 'freebuff' ? 'freebuff' : 'development',
      google: googleConfigured(c.env),
      role,
      canEdit: role === 'admin',
    },
  }
  return privateJson(c, body)
})

account.get('/stats', async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  const since = now() - 84 * 86_400_000
  const [totals, mastered, cards, days, recent, decks] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(duration_ms), 0) AS ms FROM sessions WHERE owner_sub = ?`).bind(owner),
    db.prepare(`SELECT COUNT(*) AS n FROM card_progress_v2 p JOIN decks d ON d.id = p.deck_id WHERE p.owner_sub = ? AND p.mastery >= 80 AND (d.owner_sub = ? OR d.shared = 1)`).bind(owner, owner),
    db.prepare(`SELECT COUNT(*) AS n FROM cards c JOIN decks d ON d.id = c.deck_id WHERE d.owner_sub = ? OR d.shared = 1`).bind(owner),
    db
      .prepare(
        `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n, SUM(score) AS s, SUM(total) AS t FROM sessions WHERE owner_sub = ? AND created_at >= ? GROUP BY day ORDER BY day`,
      )
      .bind(owner, since),
    db.prepare(`SELECT s.*, d.title AS deck_title FROM sessions s LEFT JOIN decks d ON d.id = s.deck_id WHERE s.owner_sub = ? ORDER BY s.created_at DESC LIMIT 12`).bind(owner),
    db
      .prepare(
        `SELECT d.id, d.title, d.hue,
          (SELECT COUNT(*) FROM cards c WHERE c.deck_id = d.id) AS card_count,
          (SELECT COALESCE(AVG(COALESCE(p.mastery, 0)), 0) FROM cards c LEFT JOIN card_progress_v2 p ON p.card_id = c.id AND p.owner_sub = ? WHERE c.deck_id = d.id) AS mastery
         FROM decks d WHERE d.owner_sub = ? OR d.shared = 1 ORDER BY mastery DESC`,
      )
      .bind(owner, owner),
  ])

  const byDay = new Map((days.results as { day: string; n: number; s: number; t: number }[]).map((r) => [r.day, r]))
  const series: Stats['days'] = []
  const cursor = new Date()
  cursor.setUTCHours(0, 0, 0, 0)
  cursor.setUTCDate(cursor.getUTCDate() - 83)
  for (let i = 0; i < 84; i++) {
    const key = cursor.toISOString().slice(0, 10)
    const row = byDay.get(key)
    series.push({ date: key, sessions: Number(row?.n ?? 0), accuracy: row && Number(row.t) ? Math.round((Number(row.s) / Number(row.t)) * 100) : null })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  const streak = streakFrom(new Set((days.results as { day: string }[]).map((r) => r.day).concat([...(await sessionDays(db, owner))])))
  const body: Stats = {
    streak: streak.current,
    longestStreak: streak.longest,
    sessions: Number((totals.results[0] as { n: number }).n),
    cardsMastered: Number((mastered.results[0] as { n: number }).n),
    cardsTotal: Number((cards.results[0] as { n: number }).n),
    minutes: Math.round(Number((totals.results[0] as { ms: number }).ms) / 60_000),
    days: series,
    recent: (recent.results as Record<string, unknown>[]).map(mapSession),
    decks: (decks.results as { id: string; title: string; hue: number; card_count: number; mastery: number }[]).map((d) => ({
      id: d.id,
      title: d.title,
      hue: Number(d.hue),
      cardCount: Number(d.card_count),
      mastery: Math.round(Number(d.mastery)),
    })),
  }
  return privateJson(c, body)
})

account.get('/storage', async (c) => {
  const row = await c
    .get('db')
    .prepare(`SELECT COALESCE(SUM(file_size), 0) AS used, COUNT(file_size) AS files FROM cards WHERE owner_sub = ?`)
    .bind(c.get('user').sub)
    .first<{ used: number; files: number }>()
  const body: Storage = { used: Number(row?.used ?? 0), files: Number(row?.files ?? 0), maxFileSize: MAX_ATTACHMENT_BYTES }
  return privateJson(c, body)
})

account.post('/account/reset', requireAdmin, async (c) => {
  const db = c.get('db')
  const owner = c.get('user').sub
  await clearOwned(db, owner, c.env.FILES)
  await seedUser(db, owner)
  await logAudit(db, c.get('user'), 'library.restore', owner)
  return privateJson(c, { ok: true })
})

account.delete('/account/data', async (c) => {
  // A student clears their own history only. Deleting decks and cards here would
  // let a demoted admin wipe the class library through their own settings page.
  const db = c.get('db')
  const admin = c.get('role') === 'admin'
  if (admin) await clearOwned(db, c.get('user').sub, c.env.FILES)
  else await clearProgress(db, c.get('user').sub)
  await logAudit(db, c.get('user'), admin ? 'library.clear' : 'progress.clear', c.get('user').sub)
  return privateJson(c, { ok: true })
})
