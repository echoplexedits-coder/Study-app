import { isSameOriginRequest } from '@freebuff/auth'
import type { FreebuffUser } from '@freebuff/auth'
import type { Context } from 'hono'

import type { AppContext, Env } from './env'

// Google sign-in is optional: it needs a Google Cloud OAuth web client. When
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are absent the button is hidden and
// /auth/google/* answers 503, so the site still runs on Freebuff auth alone.
const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN = 'https://oauth2.googleapis.com/token'
const USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo'
const SESSION_TTL_MS = 30 * 86_400_000
const STATE_TTL_SECONDS = 600

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/**
 * Only same-site paths are returned to after signing in. The value is re-parsed
 * against a throwaway origin because a plain string test misses `//evil.example`
 * variants and `/\\evil.example`, which browsers normalise into a
 * protocol-relative redirect. Control characters are rejected outright.
 */
function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/'
  if (value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return '/'
  try {
    const parsed = new URL(value, 'https://internal.invalid')
    if (parsed.origin !== 'https://internal.invalid') return '/'
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return '/'
  }
}

function origin(env: Env, request: Request): string {
  return env.APP_ORIGIN ?? new URL(request.url).origin
}

function isHttps(request: Request): boolean {
  return new URL(request.url).protocol === 'https:'
}

function sessionCookieName(request: Request): string {
  return isHttps(request) ? '__Host-recall_user' : 'recall_user'
}

function stateCookieName(request: Request): string {
  return isHttps(request) ? '__Host-recall_oauth' : 'recall_oauth'
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return null
}

function cookie(name: string, value: string, request: Request, maxAge: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(request) ? '; Secure' : ''}`
}

function redirect(location: string, cookies: string[] = [], status = 303): Response {
  const headers = new Headers({ location, 'cache-control': 'private, no-store' })
  for (const value of cookies) headers.append('set-cookie', value)
  return new Response(null, { status, headers })
}

/** The session token is HMAC-signed with a key derived from the OAuth secret. */
async function signingKey(env: Env): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(`recall-google-session:${env.GOOGLE_CLIENT_SECRET}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

type GoogleSession = { sub: string; name?: string; email?: string; picture?: string; exp: number }

async function signSession(env: Env, session: GoogleSession): Promise<string> {
  const payload = b64url(encoder.encode(JSON.stringify(session)))
  const signature = await crypto.subtle.sign('HMAC', await signingKey(env), encoder.encode(payload))
  return `${payload}.${b64url(new Uint8Array(signature))}`
}

/** Reads a Google session cookie. Never trusts the payload without the HMAC. */
export async function googleUser(env: Env, request: Request): Promise<FreebuffUser | null> {
  if (!googleConfigured(env)) return null
  const token = readCookie(request, sessionCookieName(request))
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  try {
    const valid = await crypto.subtle.verify('HMAC', await signingKey(env), fromB64url(signature), encoder.encode(payload))
    if (!valid) return null
    const session = JSON.parse(decoder.decode(fromB64url(payload))) as GoogleSession
    if (!session.sub || typeof session.exp !== 'number' || session.exp < Date.now()) return null
    return { sub: session.sub, name: session.name, email: session.email, picture: session.picture, email_verified: true }
  } catch {
    return null
  }
}

export function googleStart(c: Context<AppContext>): Response {
  const env = c.env
  if (!googleConfigured(env)) return c.json({ error: 'Google sign-in is not configured.' }, 503)
  const request = c.req.raw
  const state = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const target = new URL(AUTHORIZE)
  target.searchParams.set('client_id', env.GOOGLE_CLIENT_ID as string)
  target.searchParams.set('redirect_uri', `${origin(env, request)}/auth/google/callback`)
  target.searchParams.set('response_type', 'code')
  target.searchParams.set('scope', 'openid email profile')
  target.searchParams.set('state', state)
  target.searchParams.set('prompt', 'select_account')
  target.searchParams.set('access_type', 'online')
  const transaction = b64url(encoder.encode(JSON.stringify({ s: state, r: safeReturnTo(new URL(request.url).searchParams.get('returnTo')) })))
  return redirect(target.href, [cookie(stateCookieName(request), transaction, request, STATE_TTL_SECONDS)], 302)
}

export async function googleCallback(c: Context<AppContext>): Promise<Response> {
  const env = c.env
  if (!googleConfigured(env)) return c.json({ error: 'Google sign-in is not configured.' }, 503)
  const request = c.req.raw
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const failure = url.searchParams.get('error')

  // Always clear the single-use state cookie, whatever the outcome.
  const cleared = cookie(stateCookieName(request), '', request, 0)
  if (failure) return redirect('/?signin=cancelled', [cleared])
  const transaction = readCookie(request, stateCookieName(request))
  if (!code || !state || !transaction) return redirect('/?signin=failed', [cleared])

  let returnTo = '/'
  try {
    const parsed = JSON.parse(decoder.decode(fromB64url(transaction))) as { s?: string; r?: string }
    if (parsed.s !== state) return redirect('/?signin=failed', [cleared])
    returnTo = safeReturnTo(parsed.r ?? '/')
  } catch {
    return redirect('/?signin=failed', [cleared])
  }

  const tokenResponse = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID as string,
      client_secret: env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: `${origin(env, request)}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenResponse.ok) {
    console.error('google token exchange failed', tokenResponse.status)
    return redirect('/?signin=failed', [cleared])
  }
  const tokens = (await tokenResponse.json()) as { access_token?: string }
  if (!tokens.access_token) return redirect('/?signin=failed', [cleared])

  // The token came straight from Google over TLS, so userinfo is trustworthy
  // without re-verifying the id_token in the Worker.
  const infoResponse = await fetch(USERINFO, { headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' } })
  if (!infoResponse.ok) {
    console.error('google userinfo failed', infoResponse.status)
    return redirect('/?signin=failed', [cleared])
  }
  const info = (await infoResponse.json()) as { sub?: string; name?: string; email?: string; picture?: string }
  if (!info.sub) return redirect('/?signin=failed', [cleared])

  // Namespaced so a Google identity can never collide with, or be merged into,
  // a Freebuff account that happens to share an email address.
  const session = await signSession(env, { sub: `google:${info.sub}`, name: info.name, email: info.email, picture: info.picture, exp: Date.now() + SESSION_TTL_MS })
  return redirect(returnTo, [cleared, cookie(sessionCookieName(request), session, request, Math.floor(SESSION_TTL_MS / 1000))])
}

export async function googleSignout(c: Context<AppContext>): Promise<Response> {
  const request = c.req.raw
  if (!isSameOriginRequest(request, origin(c.env, request))) return c.json({ error: 'Cross-origin request refused.' }, 403)
  const form = await request.formData().catch(() => null)
  const returnTo = safeReturnTo(typeof form?.get('returnTo') === 'string' ? (form.get('returnTo') as string) : null)
  return redirect(returnTo, [cookie(sessionCookieName(request), '', request, 0)])
}
