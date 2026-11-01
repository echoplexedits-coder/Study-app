import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AuthStatus, Card, Deck, Me, Session, SessionResult, Stats, Storage, StudyMode } from '../../shared/types'

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

export function useInvalidate() {
  const client = useQueryClient()
  return (...keys: string[]) => Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })))
}

export function useApiMutation<TInput, TResult>(
  run: (input: TInput) => Promise<TResult>,
  invalidates: string[],
  options?: { onSuccess?: (result: TResult, input: TInput) => void; onError?: (error: Error) => void },
) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: run,
    onSuccess: async (result, input) => {
      await invalidate(...invalidates)
      options?.onSuccess?.(result, input)
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
}

// The file is the request body, so the Worker streams it straight into R2
// instead of parsing a multipart form that would buffer it in memory.
export async function uploadCardAttachment(deckId: string, cardId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type || EXTENSION_TYPES[extension] || 'application/octet-stream'
  await api(`/decks/${deckId}/cards/${cardId}/file`, {
    method: 'PUT',
    body: file,
    headers: { 'content-type': type, 'x-file-name': encodeURIComponent(file.name) },
  })
}
