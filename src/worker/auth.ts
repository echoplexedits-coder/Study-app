import { createFreebuffAuth, isSameOriginRequest } from '@freebuff/auth'
import type { FreebuffAuth, FreebuffUser } from '@freebuff/auth'
import type { Context, MiddlewareHandler } from 'hono'

import type { AppContext, Env } from './env'
import { googleUser, hasGoogleSessionCookie } from './google'
import { hasSessionCookie, readCookie, resolveIdentity, sessionAccount } from './identity'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

// One development identity, honoured only on a loopback origin when no client
// ID is configured. It lets the template run before auth is provisioned and
// can never activate on a deployed site (its origin is never loopback).
export const DEV_USER: FreebuffUser = {
  sub: 'dev-user',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  email_verified: true,
}

export function isLoopback(request: Request): boolean {
  return LOOPBACK.has(new URL(request.url).hostname)
}

export function authMode(env: Env, request: Request): 'freebuff' | 'development' | 'off' {
  if (env.FREEBUFF_CLIENT_ID) return 'freebuff'
  return isLoopback(request) ? 'development' : 'off'
}

let cached: { key: string; auth: FreebuffAuth } | undefined

/** One auth instance per isolate; recreated only if the config changes. */
export function getAuth(env: Env, request: Request): FreebuffAuth | null {
  if (!env.FREEBUFF_CLIENT_ID) return null
  const baseUrl = env.APP_ORIGIN ?? new URL(request.url).origin
  const key = `${env.FREEBUFF_CLIENT_ID}|${env.FREEBUFF_ISSUER ?? ''}|${baseUrl}`
  if (cached?.key !== key) {
    cached = {
      key,
      auth: createFreebuffAuth({
        clientId: env.FREEBUFF_CLIENT_ID,
        issuer: env.FREEBUFF_ISSUER || undefined,
        baseUrl,
        allowInsecureLocalhost: new URL(baseUrl).protocol === 'http:' && LOOPBACK.has(new URL(baseUrl).hostname),
      }),
    }
  }
  return cached.auth
}

export async function currentUser(env: Env, request: Request, db?: D1Database): Promise<FreebuffUser | null> {
  const auth = getAuth(env, request)
  const freebuff = auth ? await auth.getUser(request) : null
  if (freebuff) return freebuff
  // Google sessions are a separate identity namespace (`google:<sub>`), which
  // is only resolved onto another account when that is provably safe.
  const google = await googleUser(env, request)
  if (google) return db ? await resolveIdentity(db, google) : google
  // A Google cookie that does not verify is a broken or forged session, not an
  // absent one; it must not slide into the loopback development identity.
  if (hasGoogleSessionCookie(env, request)) return null
  // A username/password account carries an opaque token; the session row is
  // the authority, so a revoked or expired session stops working immediately.
  if (db) {
    const account = await sessionAccount(db, request)
    if (account) {
      return { sub: account.owner_sub, name: account.full_name ?? account.username ?? undefined, email: account.email ?? undefined, email_verified: false }
    }
    // A cookie that no longer resolves is a revoked or expired session — it
    // must stay signed out, never slide into the development identity.
    if (hasSessionCookie(request)) return null
  }
  return authMode(env, request) === 'development' ? DEV_USER : null
}

const AUTH_SESSION_COOKIES = [
  'myclassroom_session',
  '__Host-myclassroom_session',
  'recall_user',
  '__Host-recall_user',
  'freebuff_session',
  '__Host-freebuff_session',
] as const

/**
 * Only an actual sign-in cookie should switch `/` from the static landing page
 * to the app shell. Analytics, consent or other unrelated cookies must not.
 * The OAuth transaction cookie is deliberately absent: it is not a session.
 */
export function hasAuthCookie(request: Request): boolean {
  return AUTH_SESSION_COOKIES.some((name) => Boolean(readCookie(request, name)))
}

export function appOrigin(env: Env, request: Request): string {
  return env.APP_ORIGIN ?? new URL(request.url).origin
}

/** Requires a signed-in user and, for mutations, a same-origin request. */
export const requireUser: MiddlewareHandler<AppContext> = async (c, next) => {
  const request = c.req.raw
  if (request.method !== 'GET' && request.method !== 'HEAD' && !isSameOriginRequest(request, appOrigin(c.env, request))) {
    return c.json({ error: 'Cross-origin request refused.' }, 403)
  }
  const user = await currentUser(c.env, request, c.get('db') as D1Database | undefined)
  if (!user) return c.json({ error: 'Sign in required.' }, 401)
  c.set('user', user)
  await next()
}

export function privateJson<T>(c: Context<AppContext>, body: T, status = 200) {
  c.header('Cache-Control', 'private, no-store')
  return c.json(body as never, status as never)
}
