// Rules shared by the Worker (authority) and the app (instant feedback).
// Nothing here touches the network or the database: the server re-runs every
// check before it writes, so a client can never talk itself into a username.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/** Lowercase letters, digits and single underscores, starting with a letter. */
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]*$/

export const USERNAME_RULES_TEXT = '3–20 characters: letters, numbers and underscores, starting with a letter.'

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 200

/**
 * Names the platform keeps for itself. They are refused at the API, not just
 * greyed out in the form, so no student can impersonate the site or support.
 */
export const RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'admin123',
  'support',
  'system',
  'official',
  'myclassroom',
  'moderator',
  'root',
  'staff',
  'help',
  'helpdesk',
  'security',
  'owner',
  'teacher',
  'school',
  'api',
  'www',
  'login',
  'signin',
  'signup',
  'register',
  'account',
  'settings',
  'profile',
  'notes',
  'resources',
  'quizzes',
  'library',
  'deleted',
  'anonymous',
  'noreply',
  'billing',
  'privacy',
  'terms',
  'contact',
]

const RESERVED = new Set(RESERVED_USERNAMES)

/** Trim, drop a leading @, unify unicode, lowercase — the one stored form. */
export function normalizeUsername(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/^@+/, '').trim().toLowerCase()
}

export function isReservedUsername(raw: string): boolean {
  return RESERVED.has(normalizeUsername(raw))
}

/** A human sentence for the first broken rule, or null when the name is usable. */
export function usernameProblem(raw: string): string | null {
  const value = normalizeUsername(raw)
  if (!value) return 'Choose a username.'
  if (value.length < USERNAME_MIN) return `Usernames need at least ${USERNAME_MIN} characters.`
  if (value.length > USERNAME_MAX) return `Usernames can be at most ${USERNAME_MAX} characters.`
  if (!/^[a-z]/.test(value)) return 'Usernames must start with a letter.'
  if (!USERNAME_PATTERN.test(value)) return 'Use letters, numbers and underscores only — no spaces or symbols.'
  if (value.includes('__')) return 'Use single underscores — consecutive underscores are not allowed.'
  if (value.endsWith('_')) return 'Usernames cannot end with an underscore.'
  if (RESERVED.has(value)) return 'That username is reserved for the platform.'
  return null
}

export type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid' | 'error'

/** 0–4, for the meter. Length matters most; variety lifts it. */
export function passwordScore(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= PASSWORD_MIN) score += 1
  if (password.length >= 12) score += 1
  if (password.length >= 16) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1
  if (/^(.)\1+$/.test(password) || /^(password|12345678|qwerty)/i.test(password)) score = Math.min(score, 1)
  return Math.min(4, score)
}

export function passwordProblem(password: string, context: { username?: string; email?: string; name?: string } = {}): string | null {
  if (!password) return 'Choose a password.'
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Mix letters and numbers so it is harder to guess.'
  const lower = password.toLowerCase()
  for (const value of [context.username, context.email?.split('@')[0], context.name?.split(' ')[0]]) {
    if (value && value.length >= 3 && lower.includes(value.toLowerCase())) return 'Your password cannot contain your own name, username or email.'
  }
  if (RESERVED.has(lower) || ['password', 'password1', '12345678', 'qwertyui'].includes(lower)) return 'That password is too common. Choose something else.'
  return null
}

export const PASSWORD_STRENGTH_LABELS = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent'] as const
