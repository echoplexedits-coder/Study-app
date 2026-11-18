import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  AdminUsersResponse,
  AuthStatus,
  Card,
  ConsentStatus,
  Deck,
  Me,
  NoteFile,
  Profile,
  ResetRequest,
  Session,
  SessionResult,
  Stats,
  Storage,
  StudyMode,
} from '../../shared/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {}
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...rest,
    headers: { accept: 'application/json', ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  if (!response.ok) {
    let message = response.statusText
    let code: string | undefined
    try {
      const body = (await response.json()) as { error?: string; message?: string }
      message = body.message ?? body.error ?? message
      code = body.error
    } catch {
      /* no body */
    }
    throw new ApiError(response.status, message, code)
  }
  return (await response.json()) as T
}

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), retry: false, staleTime: 60_000 })
export const useAuthStatus = () => useQuery({ queryKey: ['auth-status'], queryFn: () => api<AuthStatus>('/auth/status'), retry: false, staleTime: 60_000 })
export const useDecks = () => useQuery({ queryKey: ['decks'], queryFn: () => api<{ items: Deck[] }>('/decks') })
export const useDeck = (id: string | undefined) =>
  useQuery({
    queryKey: ['deck', id],
    queryFn: () => api<{ deck: Deck; cards: Card[]; sessions: Session[] }>(`/decks/${id}`),
    enabled: Boolean(id),
  })
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/stats') })
export const useStorage = () => useQuery({ queryKey: ['storage'], queryFn: () => api<Storage>('/storage') })

/** The read-only classwork library. Available to every signed-in account. */
export const useNotes = () =>
  useQuery({ queryKey: ['notes'], queryFn: () => api<{ files: NoteFile[] }>('/notes'), staleTime: 30_000 })

/** Each key segment is encoded, so an R2 key with slashes stays one path tail. */
export function noteUrl(key: string, download = false) {
  const path = key.split('/').map(encodeURIComponent).join('/')
  return `/api/notes/file/${path}${download ? '?download=1' : ''}`
}
export const useConsent = () =>
  useQuery({ queryKey: ['consent'], queryFn: () => api<ConsentStatus>('/legal/status'), retry: false, staleTime: 0 })

/** Records the accepted policy version and the moment it was accepted. */
export function acceptPolicies(input: { version: string; terms: boolean; privacy: boolean; age: boolean }) {
  return api<{ ok: true; version: string; acceptedAt: number }>('/legal/consent', { method: 'POST', json: input })
}

/** Downloads a copy of everything the server holds about the signed-in person. */
export async function downloadMyData(): Promise<string> {
  const response = await fetch('/api/legal/export', { credentials: 'same-origin', headers: { accept: 'application/json' } })
  if (!response.ok) {
    let message = 'Your data could not be exported.'
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      message = body.message ?? body.error ?? message
    } catch {
      /* no body */
    }
    throw new ApiError(response.status, message)
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'myclassroom-my-data.json'
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give Safari a moment to start the download before releasing the URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  return name
}

export function deleteAccount(confirm: string) {
  return api<{ ok: true; deleted: { decks: number; attachments: number; sessions: number } }>('/legal/delete-account', {
    method: 'POST',
    json: { confirm },
  })
}

export function requestDeletion(kind: 'delete_account' | 'delete_data', details: string) {
  return api<{ ok: true; duplicate: boolean }>('/legal/deletion-request', { method: 'POST', json: { kind, details } })
}

export function fileReport(input: {
  kind: 'content' | 'copyright'
  targetType: 'deck' | 'card' | 'classwork' | 'other'
  targetId?: string
  reason: string
  details: string
  goodFaith: boolean
  accuracyConfirmed: boolean
  rightsHolder?: boolean
}) {
  return api<{ ok: true; id: string }>('/legal/report', { method: 'POST', json: input })
}

export function sendContact(input: { name: string; email: string; topic: string; message: string; consent: boolean; website?: string }) {
  return api<{ ok: true }>('/legal/contact', { method: 'POST', json: input })
}

export function useInvalidate() {
  const client = useQueryClient()
  return (...keys: string[]) => Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })))
}

export function useApiMutation<TInput, TResult>(
  run: (input: TInput) => Promise<TResult>,
  invalidates: string[],
  options?: { onSuccess?: (result: TResult, input: TInput) => void | Promise<void>; onError?: (error: Error) => void },
) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: run,
    onSuccess: async (result, input) => {
      await invalidate(...invalidates)
      // Await this so a create flow can finish its follow-up upload before the
      // mutation leaves the pending state.
      await options?.onSuccess?.(result, input)
    },
    onError: (error) => options?.onError?.(error),
  })
}

export function recordSession(deckId: string, mode: StudyMode, results: SessionResult[], durationMs: number) {
  return api<{ session: { id: string; score: number; total: number; accuracy: number } }>(`/decks/${deckId}/sessions`, {
    method: 'POST',
    json: { mode, results, durationMs },
  })
}

// Browsers report no type for some extensions; the server only accepts the
// allowlist, so map the common ones instead of sending octet-stream.
const EXTENSION_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  rtf: 'application/rtf',
  epub: 'application/epub+zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

// The file is the request body, so the Worker streams it straight into R2
// instead of parsing a multipart form that would buffer it in memory.
export async function uploadClassworkFile(file: File, name: string, class_: string, subject: string, date: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  form.append('class', class_)
  form.append('subject', subject)
  form.append('date', date)
  await api('/admin/files', { method: 'POST', body: form })
}

export async function deleteClassworkFile(name: string) {
  await api('/admin/files/' + encodeURIComponent(name), { method: 'DELETE' })
}

export async function uploadCardAttachment(deckId: string, cardId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type || EXTENSION_TYPES[extension] || 'application/octet-stream'
  await api(`/decks/${deckId}/cards/${cardId}/file`, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': type, 'x-file-name': encodeURIComponent(file.name) },
  })
}

/** One cover per deck; replacing it removes the previous R2 object. */
export async function uploadDeckCover(deckId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type || EXTENSION_TYPES[extension] || 'application/octet-stream'
  await api(`/decks/${deckId}/cover`, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': type, 'x-file-name': encodeURIComponent(file.name) },
  })
}

export async function deleteDeckCover(deckId: string) {
  await api(`/decks/${deckId}/cover`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Identity: registration, username/password sign-in, profile, admin roster
// ---------------------------------------------------------------------------

export function registerAccount(input: { fullName: string; username: string; email: string; password: string; confirmPassword: string }) {
  return api<{ ok: true; user: { sub: string; username: string; studentId: string } }>('/auth/register', { method: 'POST', json: input })
}

export function loginWithPassword(input: { identifier: string; password: string }) {
  return api<{ ok: true; user: { sub: string; username: string } }>('/auth/login', { method: 'POST', json: input })
}

export function logoutPassword() {
  return api<{ ok: true }>('/auth/logout', { method: 'POST' })
}

export function requestPasswordReset(identifier: string) {
  return api<{ ok: true; mail: boolean }>('/auth/password/request', { method: 'POST', json: { identifier } })
}

export function resetPassword(input: { token: string; password: string; confirmPassword: string }) {
  return api<{ ok: true }>('/auth/password/reset', { method: 'POST', json: input })
}

export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile'), staleTime: 30_000 })

export function updateProfile(input: { fullName: string }) {
  return api<{ ok: true; fullName: string }>('/profile', { method: 'PATCH', json: input })
}

export function changeUsername(username: string) {
  return api<{ ok: true; username: string }>('/profile/username', { method: 'POST', json: { username } })
}

export function changePassword(input: { currentPassword?: string; password: string; confirmPassword: string }) {
  return api<{ ok: true }>('/profile/password', { method: 'POST', json: input })
}

export const useAdminUsers = (query: string, page: number) =>
  useQuery({
    queryKey: ['admin-users', query, page],
    queryFn: () => api<AdminUsersResponse>(`/admin/users?q=${encodeURIComponent(query)}&page=${page}`),
    staleTime: 15_000,
  })

export const useResetRequests = (enabled: boolean) =>
  useQuery({ queryKey: ['reset-requests'], queryFn: () => api<{ requests: ResetRequest[] }>('/admin/reset-requests'), enabled, staleTime: 15_000 })

export function setAccountStatus(sub: string, status: 'active' | 'suspended') {
  return api<{ ok: true; status: string }>(`/admin/users/${encodeURIComponent(sub)}/status`, { method: 'POST', json: { status } })
}

export function issueResetLink(id: string) {
  return api<{ ok: true; path: string; expiresInMinutes: number }>(`/admin/reset-requests/${encodeURIComponent(id)}/link`, { method: 'POST' })
}
