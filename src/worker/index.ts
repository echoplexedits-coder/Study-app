import { Hono } from 'hono'

import { authMode, getAuth, requireUser } from './auth'
import { loadRole, requireDb } from './db'
import type { AppContext, Env } from './env'
import { googleCallback, googleConfigured, googleSignout, googleStart } from './google'
import { account } from './routes/account'
import { decks } from './routes/decks'
import { admin } from './routes/admin'
import { adminFiles } from './routes/admin-files'
import { adminLegal } from './routes/admin-legal'
import { contactHandler, legal, requireConsent } from './routes/legal'

const app = new Hono<AppContext>()

// Security headers on every response. The CSP is sent with HTML only (a PDF or
// image download is not a document that should be governed by it) and is strict:
// one same-origin bundle, no inline scripts, no eval, no third-party origins.
const CSP =
  "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'"

app.use('*', async (c, next) => {
  await next()
  const res = c.res
  const headers = new Headers(res.headers)
  headers.set('x-content-type-options', 'nosniff')
  headers.set('referrer-policy', 'no-referrer')
  headers.set('x-frame-options', 'DENY')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
  headers.set('cross-origin-opener-policy', 'same-origin')
  if (new URL(c.req.url).protocol === 'https:') headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains')
  if ((headers.get('content-type') ?? '').includes('text/html')) headers.set('content-security-policy', CSP)
  const body = res.status === 204 || res.status === 304 ? null : res.body
  c.res = new Response(body, { status: res.status, statusText: res.statusText, headers })
})

app.get('/api/auth/status', (c) => {
  c.header('Cache-Control', 'private, no-store')
  return c.json({ mode: authMode(c.env, c.req.raw), database: Boolean(c.env.DB), files: Boolean(c.env.FILES), google: googleConfigured(c.env) })
})
app.get('/api/health', (c) => c.json({ ok: true }))

// Optional Google OAuth.
app.get('/auth/google/start', googleStart)
app.get('/auth/google/callback', googleCallback)
app.post('/auth/google/signout', googleSignout)

// The Contact page is deliberately public: a rights holder or parent needs a
// way to reach the operator without an account. It is registered before the
// signed-in middleware below, so it never requires a session.
app.post('/api/legal/contact', requireDb, contactHandler)

// Middleware for all /api/* routes.
app.use('/api/*', requireUser, requireDb, loadRole, requireConsent)

// Account routes: /api/me, /api/stats, /api/storage and /api/account/*.
// Mounted at /api rather than /api/account because the client fetches /api/me,
// /api/stats and /api/storage directly — a nested mount left those three 404ing
// (or returning a role-only stub) while the UI rendered them as failures.
app.route('/api', account)

// Deck routes.
app.route('/api/decks', decks)

// Admin routes — registered directly with the /api/admin prefix so Hono's
// router resolves them instead of relying on subApp mount semantics.
app.route('/api', admin)
app.route('/api', adminFiles)
app.route('/api', adminLegal)
app.route('/api', legal)

app.onError((error, c) => {
  // A malformed JSON body is the client's mistake, not a server failure.
  if (error instanceof SyntaxError) return c.json({ error: 'Invalid JSON body.' }, 400)
  console.error(error)
  return c.json({ error: 'Something went wrong.' }, 500)
})
app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Not found.' }, 404) : c.env.ASSETS.fetch(c.req.raw)))

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Sign in with Freebuff owns /auth/freebuff/* and keeps sessions fresh.
    // Without a client ID the app falls back to the loopback development user.
    const auth = getAuth(env, request)
    if (auth) {
      const handler = (req: Request) => app.fetch(req, env, ctx)
      return auth.wrap(handler)(request)
    }
    return app.fetch(request, env, ctx)
  },
}
