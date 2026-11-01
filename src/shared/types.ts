// Types shared by the Worker (src/worker) and the app (src/app).

export const BRAND = 'Recall'

// A Worker request body is capped at 100 MB by the platform, so the app stays
// just under it. The body is streamed into R2, never buffered in memory.
export const MAX_ATTACHMENT_BYTES = 90 * 1024 * 1024

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
}

export interface Me {
  user: { sub: string; name?: string; email?: string; picture?: string }
  streak: number
  seeded: boolean
  capabilities: { database: boolean; files: boolean; auth: 'freebuff' | 'google' | 'development'; google: boolean }
}

export interface Storage {
  used: number
  files: number
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
