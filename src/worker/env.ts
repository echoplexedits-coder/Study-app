import type { FreebuffUser } from '@freebuff/auth'

import type { Role } from '../shared/types'

export interface Env {
  ASSETS: Fetcher
  // Attached by Freebuff Sites once provisioned (sites_add_storage). Optional so
  // the app can explain what is missing instead of crashing.
  DB?: D1Database
  FILES?: R2Bucket
  // Injected on deploy once Sign in with Freebuff is enabled (sites_enable_auth).
  FREEBUFF_CLIENT_ID?: string
  FREEBUFF_ISSUER?: string
  APP_ORIGIN?: string
  // Optional Google OAuth web client. Without both values the Google button is
  // hidden and /auth/google/* answers 503, leaving Freebuff auth as the only way in.
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

export type Variables = {
  user: FreebuffUser
  db: D1Database
  role: Role
}

export type AppContext = { Bindings: Env; Variables: Variables }
