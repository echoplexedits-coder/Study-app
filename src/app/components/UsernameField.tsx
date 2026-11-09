import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, AtSign, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { cx } from '../lib/cx'
import { USERNAME_MAX, USERNAME_RULES_TEXT, isReservedUsername, normalizeUsername, usernameProblem, type UsernameState } from '../../shared/identity'

export interface UsernameCheckState {
  /** The normalized value the answer belongs to. */
  value: string
  state: UsernameState
  message: string
  suggestions: string[]
}

const EMPTY: UsernameCheckState = { value: '', state: 'idle', message: '', suggestions: [] }

/**
 * Live availability, debounced and cancellable. Every keystroke aborts the
 * previous request, and an answer is only displayed if it belongs to the text
 * currently in the field — so an older reply can never light up a green tick
 * for a username the person has already changed.
 */
export function useUsernameCheck(value: string, options: { enabled?: boolean; current?: string | null } = {}): UsernameCheckState {
  const [result, setResult] = useState<UsernameCheckState>(EMPTY)
  const enabled = options.enabled !== false
  const current = options.current ?? null

  useEffect(() => {
    const normalized = normalizeUsername(value)
    if (!enabled || !normalized) {
      setResult(EMPTY)
      return
    }
    const problem = usernameProblem(normalized)
    if (problem) {
      setResult({ value: normalized, state: isReservedUsername(normalized) ? 'reserved' : 'invalid', message: problem, suggestions: [] })
      return
    }
    if (current && normalized === normalizeUsername(current)) {
      setResult({ value: normalized, state: 'available', message: 'That is your current username.', suggestions: [] })
      return
    }
    // Show "checking" at once: a previous green tick must not survive an edit.
    setResult({ value: normalized, state: 'checking', message: 'Checking username availability…', suggestions: [] })

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/username?u=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
        const body = (await response.json()) as { state?: UsernameState; message?: string; suggestions?: string[]; error?: string }
        if (controller.signal.aborted) return
        if (!response.ok || !body.state) {
          setResult({ value: normalized, state: 'error', message: body.message ?? 'Could not check that username. Try again.', suggestions: [] })
          return
        }
        setResult({ value: normalized, state: body.state, message: body.message ?? '', suggestions: body.suggestions ?? [] })
      } catch (error) {
        if (controller.signal.aborted || (error as Error)?.name === 'AbortError') return
        setResult({ value: normalized, state: 'error', message: 'Could not check that username. Check your connection and retry.', suggestions: [] })
      }
    }, 320)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value, enabled, current])

  return result
}

/** Only a confirmed answer for the current text unlocks the submit button. */
export function usernameReady(check: UsernameCheckState, value: string): boolean {
  return check.state === 'available' && check.value === normalizeUsername(value) && !usernameProblem(value)
}

function StatusIcon({ state }: { state: UsernameState }) {
  if (state === 'checking') return <Loader2 className="size-[18px] animate-spin text-muted" aria-hidden />
  if (state === 'available') {
    return (
      <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 22 }} className="grid size-[18px] place-items-center">
        <CheckCircle2 className="size-[18px] text-success" aria-hidden />
      </motion.span>
    )
  }
  if (state === 'taken' || state === 'reserved') {
    return (
      <motion.span initial={{ x: -3 }} animate={{ x: [0, -3, 3, -2, 0] }} transition={{ duration: 0.32 }} className="grid size-[18px] place-items-center">
        <XCircle className="size-[18px] text-danger" aria-hidden />
      </motion.span>
    )
  }
  if (state === 'invalid') return <AlertCircle className="size-[18px] text-danger" aria-hidden />
  if (state === 'error') return <AlertCircle className="size-[18px] text-warning" aria-hidden />
  return <AtSign className="size-[16px] text-faint" aria-hidden />
}

export function UsernameField({
  value,
  onChange,
  check,
  current,
  label = 'Username',
  autoFocus,
  disabled,
  hint,
}: {
  value: string
  onChange: (next: string) => void
  check: UsernameCheckState
  current?: string | null
  label?: string
  autoFocus?: boolean
  disabled?: boolean
  hint?: string
}) {
  const id = useId()
  const shown = check.state === 'idle' ? 'idle' : check.state
  const tone =
    shown === 'available' ? 'text-success' : shown === 'checking' ? 'text-muted' : shown === 'invalid' || shown === 'taken' || shown === 'reserved' ? 'text-danger' : shown === 'error' ? 'text-warning' : 'text-faint'

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[12.5px] font-medium text-fg">
          {label}
        </label>
        <span className="text-[11px] text-faint">{USERNAME_RULES_TEXT}</span>
      </div>

      <div
        className={cx(
          'flex h-11 items-center gap-2 rounded-control border bg-surface px-3 transition-[border-color,box-shadow]',
          shown === 'available' && 'border-success/45 focus-within:ring-success/15',
          (shown === 'taken' || shown === 'reserved' || shown === 'invalid') && 'border-danger/45 focus-within:ring-danger/12',
          shown === 'idle' || shown === 'checking' ? 'border-line-strong focus-within:border-accent' : '',
          'focus-within:ring-[3px]',
        )}
      >
        <AtSign className="size-[15px] shrink-0 text-faint" aria-hidden />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={USERNAME_MAX + 4}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder="yash123"
          aria-invalid={shown === 'taken' || shown === 'invalid' || shown === 'reserved'}
          aria-describedby={`${id}-status`}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg placeholder:text-faint focus:outline-none disabled:opacity-60"
        />
        <StatusIcon state={shown} />
      </div>

      <div id={`${id}-status`} aria-live="polite" className="min-h-[16px]">
        <AnimatePresence mode="wait" initial={false}>
          {shown !== 'idle' && (
            <motion.p
              key={check.state + check.message}
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className={cx('text-[11.5px] font-medium', tone)}
            >
              {shown === 'available' && '✓ '}
              {shown === 'taken' && '✕ '}
              {check.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {check.suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-faint">Try:</span>
          {check.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange(suggestion)}
              className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11.5px] font-medium text-accent-deep transition-colors hover:border-accent/40 hover:bg-accent-soft"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {hint && !check.message && <p className="text-[11.5px] text-faint">{hint}</p>}
      {current && <p className="text-[11.5px] text-faint">Currently @{current}</p>}
    </div>
  )
}

/** Reusable "is this still true" guard for effects that act on the answer. */
export function useConfirmed(check: UsernameCheckState, value: string): boolean {
  const ref = useRef(false)
  ref.current = usernameReady(check, value)
  return ref.current
}
