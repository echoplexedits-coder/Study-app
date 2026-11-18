// Types shared by the Worker (src/worker) and the app (src/app).

export const BRAND = 'myclassroom'

export type Role = 'admin' | 'student'

// A Worker request body is capped at 100 MB by the platform, so the app stays
// just under it. The body is streamed into R2, never buffered in memory.
export const MAX_ATTACHMENT_BYTES = 90 * 1024 * 1024

// A cover is loaded with the library, so it is kept much smaller than a file
// that is only downloaded when someone opens a card.
export const MAX_COVER_BYTES = 8 * 1024 * 1024

export type StudyMode = 'flashcards' | 'learn' | 'match'

export interface Deck {
  id: string
  title: string
  description: string | null
  hue: number
  cardCount: number
  mastered: number
  mastery: number
  dueCount: number
  hasCover: boolean
  // Changes whenever the cover is replaced; used to bust the browser cache.
  coverVersion: string | null
  lastStudiedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface Card {
  id: string
  deckId: string
  term: string
  definition: string
  // Images render inline; any other attachment is offered as a download.
  hasImage: boolean
  fileName: string | null
  fileSize: number
  fileType: string | null
  // Changes whenever the attachment is replaced; used to bust the browser cache.
  fileVersion: string | null
  position: number
  progress: { correct: number; incorrect: number; streak: number; mastery: number; nextDue: number | null; lastSeen: number | null }
}

export interface Session {
  id: string
  deckId: string
  deckTitle?: string
  mode: StudyMode
  score: number
  total: number
  accuracy: number
  durationMs: number
  createdAt: number
}

export interface AuthStatus {
  mode: 'freebuff' | 'development' | 'off'
  database: boolean
  files: boolean
  google: boolean
  /** Username/password accounts are available (needs the database). */
  password: boolean
  /** A transactional email provider is configured for reset links. */
  mail: boolean
}

export type AccountStatus = 'active' | 'suspended'

// The policy version a person accepted, and when. `accepted` is false when the
// newest acceptance predates the current POLICY_VERSION.
export interface ConsentStatus {
  version: string
  effective: string
  accepted: boolean
  acceptedAt: number | null
  acceptedVersion: string | null
}

export interface MeUser {
  /** Permanent internal id. Never shown as an editable value, never reused. */
  sub: string
  name?: string
  email?: string
  picture?: string
  /** Unique, case-insensitive, owned by exactly one account. */
  username: string | null
  /** Student-facing identity, e.g. MC-2026-000124. */
  studentId: string | null
  /** True until the account claims a username (the onboarding gate). */
  needsUsername: boolean
  hasPassword: boolean
  status: AccountStatus
  createdAt: number
}

export interface MeConsent {
  version: string
  effective: string
  accepted: boolean
  acceptedAt: number | null
}

export interface Me {
  user: MeUser
  streak: number
  seeded: boolean
  consent: MeConsent
  capabilities: {
    database: boolean
    files: boolean
    auth: 'freebuff' | 'google' | 'development' | 'password'
    google: boolean
    role: Role
    canEdit: boolean
  }
}

/** The signed-in person's own account record (settings page). */
export interface Profile {
  sub: string
  fullName: string | null
  username: string | null
  studentId: string | null
  email: string | null
  role: Role
  status: AccountStatus
  hasPassword: boolean
  createdAt: number
  usernameChangedAt: number | null
}

/** One answer from the live username checker. */
export interface UsernameCheck {
  username: string
  state: 'available' | 'taken' | 'reserved' | 'invalid'
  message: string
  suggestions: string[]
  own?: boolean
}

/** A row in the admin roster. Never contains a password or a session token. */
export interface AdminUser {
  sub: string
  username: string | null
  fullName: string | null
  email: string | null
  studentId: string | null
  status: AccountStatus
  role: Role
  hasPassword: boolean
  createdAt: number
}

export interface AdminUsersResponse {
  users: AdminUser[]
  counts: { total: number; admins: number; students: number; suspended: number }
  page: number
  pageSize: number
}

export interface ResetRequest {
  id: string
  sub: string | null
  identifier: string
  username: string | null
  studentId: string | null
  status: string
  createdAt: number
}

export interface Storage {
  used: number
  files: number
  maxFileSize: number
}

/** Current R2 usage and the platform allowance shown on the admin dashboard. */
export interface StorageUsage {
  bytes: number
  files: number
  limitBytes: number
  remaining: number
  percent: number
  warning: boolean
  maxFileSize: number
}

export interface Stats {
  streak: number
  longestStreak: number
  sessions: number
  cardsMastered: number
  cardsTotal: number
  minutes: number
  days: { date: string; sessions: number; accuracy: number | null }[]
  recent: Session[]
  decks: { id: string; title: string; hue: number; mastery: number; cardCount: number }[]
}

export interface SessionResult {
  cardId: string
  correct: boolean
}

/** One classwork document in the read-only notes library. */
export interface NoteFile {
  // The R2 object key. Never rendered; used to build the download URL.
  key: string
  name: string
  className: string
  subject: string
  date: string
  size: number
  contentType: string | null
  uploadedAt: number
}


