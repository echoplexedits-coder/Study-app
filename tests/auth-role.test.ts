import { describe, expect, test } from 'bun:test'
import type { FreebuffUser } from '@freebuff/auth'

import { isProviderVerified, roleFor } from '../src/worker/db'
import { emailConflict, resolveIdentity } from '../src/worker/identity'

type UserRow = { owner_sub: string; email_key: string; password_hash: string | null }
type RoleRow = { email: string; role: string }
type LinkRow = { provider_sub: string; owner_sub: string }

/**
 * A tiny D1 stand-in for the handful of first-row queries exercised by the
 * identity helpers. It keeps these tests independent of a live database.
 */
class FakeDb {
  users: UserRow[]
  roles: RoleRow[]
  links: LinkRow[]

  constructor(input: { users?: UserRow[]; roles?: RoleRow[]; links?: LinkRow[] } = {}) {
    this.users = input.users ?? []
    this.roles = input.roles ?? []
    this.links = input.links ?? []
  }

  prepare(sql: string) {
    const query = sql.replace(/\s+/g, ' ').trim()
    return {
      bind: (...args: unknown[]) => ({
        first: async () => {
          const value = String(args[0] ?? '').toLowerCase()
          if (query.includes('FROM users WHERE email_key = ? LIMIT 1')) {
            return this.users.find((row) => row.email_key === value) ?? null
          }
          if (query.includes('FROM users WHERE email_key = ?')) {
            return this.users.find((row) => row.email_key === value) ?? null
          }
          if (query.includes('FROM roles WHERE lower(email) = ?')) {
            return this.roles.some((row) => row.email.toLowerCase() === value) ? { n: 1 } : null
          }
          if (query.includes('FROM roles WHERE email = ?')) {
            return this.roles.find((row) => row.email.toLowerCase() === value) ?? null
          }
          if (query.includes('FROM identity_links WHERE provider_sub = ?')) {
            return this.links.find((row) => row.provider_sub === args[0]) ?? null
          }
          if (query.includes('FROM users WHERE owner_sub = ?')) {
            return this.users.find((row) => row.owner_sub === args[0]) ?? null
          }
          return null
        },
      }),
    }
  }
}

const db = (input: ConstructorParameters<typeof FakeDb>[0] = {}) => new FakeDb(input) as unknown as D1Database
const adminEmail = 'admin@example.com'
const google: FreebuffUser = { sub: 'google:123', email: adminEmail, email_verified: true }
const unverifiedGoogle: FreebuffUser = { sub: 'google:456', email: adminEmail, email_verified: false }
const passwordUser: FreebuffUser = { sub: 'local:one', email: adminEmail, email_verified: false }

describe('provider-verified admin roles', () => {
  test('a password account never inherits an admin role by email', async () => {
    const database = db({ roles: [{ email: adminEmail, role: 'admin' }] })
    expect(await roleFor(database, passwordUser)).toBe('student')
  })

  test('a verified Google account can hold the admin role', async () => {
    const database = db({ roles: [{ email: adminEmail, role: 'admin' }] })
    expect(await roleFor(database, google)).toBe('admin')
  })

  test('an unverified Google email cannot hold the admin role', async () => {
    const database = db({ roles: [{ email: adminEmail, role: 'admin' }] })
    expect(await roleFor(database, unverifiedGoogle)).toBe('student')
  })

  test('a Freebuff identity is treated as provider-verified', () => {
    expect(isProviderVerified({ sub: 'freebuff:123', email: adminEmail })).toBe(true)
    expect(isProviderVerified({ sub: 'local:one', email: adminEmail })).toBe(false)
  })
})

describe('password signup email conflicts', () => {
  test('a role address is blocked before any provider user row exists', async () => {
    const database = db({ roles: [{ email: adminEmail, role: 'admin' }] })
    expect(await emailConflict(database, adminEmail)).toBe('role')
  })

  test('an existing provider account with the same email blocks password signup', async () => {
    const database = db({ users: [{ owner_sub: 'freebuff:123', email_key: adminEmail, password_hash: null }] })
    expect(await emailConflict(database, adminEmail)).toBe('provider')
  })

  test('an existing password account is reported as a password conflict', async () => {
    const database = db({ users: [{ owner_sub: 'local:one', email_key: adminEmail, password_hash: 'pbkdf2-sha256$...' }] })
    expect(await emailConflict(database, adminEmail)).toBe('password')
  })

  test('a fresh address is not a conflict', async () => {
    expect(await emailConflict(db(), 'new@example.com')).toBeNull()
  })
})

describe('reverse order: password account first', () => {
  test('Google cannot resolve onto a password account with the same verified email', async () => {
    const database = db({ users: [{ owner_sub: 'local:one', email_key: adminEmail, password_hash: 'pbkdf2-sha256$...' }] })
    expect(await resolveIdentity(database, google)).toBeNull()
  })
})
