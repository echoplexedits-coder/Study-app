import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { ArrowRight, Loader2, LogOut, ShieldOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { LegalFooter } from '../components/LegalFooter'
import { Brand } from '../components/SiteNav'
import { UsernameField, useUsernameCheck, usernameReady } from '../components/UsernameField'
import { changeUsername, useMe } from '../lib/api'
import { signOut } from '../lib/auth'
import { normalizeUsername } from '../../shared/identity'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(120%_90%_at_50%_-10%,#ffffff_0%,#eff7ff_36%,#dcecfc_68%,#cde2f8_100%)]">
      <header className="mx-auto flex h-20 w-full max-w-[1120px] items-center px-5 sm:px-8">
        <Brand />
      </header>
      <main className="mx-auto grid w-full max-w-[560px] flex-1 place-items-center px-5 pb-16">{children}</main>
      <LegalFooter />
    </div>
  )
}

/**
 * The onboarding gate. An account exists and is signed in, but has not claimed
 * its permanent username yet — Google and Freebuff accounts arrive here once.
 */
export function ChooseUsername() {
  const me = useMe()
  const client = useQueryClient()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const check = useUsernameCheck(username)
  const ready = usernameReady(check, username)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setError('')
    setPending(true)
    try {
      await changeUsername(normalizeUsername(username))
      // The gate is driven by /api/me, so refetching it lets the app through.
      await client.invalidateQueries({ queryKey: ['me'] })
    } catch (failure) {
      setError((failure as Error).message)
      setPending(false)
    }
  }

  return (
    <Frame>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full rounded-panel border border-line/80 bg-surface/92 p-7 shadow-elevated backdrop-blur-xl sm:p-9"
      >
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.28em] text-accent/70">Almost there</p>
        <h1 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fg-deep sm:text-[32px]">Choose your username.</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
          This is how your classmates and teachers find you. It is unique across MyClassroom, checked live against the database, and can be changed later from settings.
        </p>

        <dl className="mt-6 grid gap-2 rounded-card border border-line/70 bg-surface-2/60 p-4 text-[12.5px]">
          {me.data?.user.name && (
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Name</dt>
              <dd className="truncate font-medium text-fg">{me.data.user.name}</dd>
            </div>
          )}
          {me.data?.user.email && (
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Email</dt>
              <dd className="truncate font-medium text-fg">{me.data.user.email}</dd>
            </div>
          )}
          {me.data?.user.studentId && (
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Student ID</dt>
              <dd className="font-mono text-[12px] font-medium tracking-tight text-fg">{me.data.user.studentId}</dd>
            </div>
          )}
        </dl>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <UsernameField value={username} onChange={setUsername} check={check} autoFocus />
          {error && <p role="alert" className="rounded-control border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger">{error}</p>}
          <button
            type="submit"
            disabled={!ready || pending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <>Claim username <ArrowRight className="size-4" aria-hidden /></>}
          </button>
        </form>

        <button
          type="button"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true)
            try {
              await signOut(me.data?.capabilities.auth ?? 'password')
            } catch {
              setSigningOut(false)
            }
          }}
          className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-fg"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sign out instead
        </button>
      </motion.div>
    </Frame>
  )
}

/** A suspended account keeps its data, but the API refuses every request. */
export function AccountSuspended() {
  const me = useMe()
  const [pending, setPending] = useState(false)
  return (
    <Frame>
      <div className="w-full rounded-panel border border-line/80 bg-surface/92 p-8 text-center shadow-elevated backdrop-blur-xl">
        <div className="mx-auto grid size-12 place-items-center rounded-card bg-danger-soft text-danger">
          <ShieldOff className="size-5" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-[26px] font-semibold tracking-[-0.02em] text-fg-deep">This account is suspended</h1>
        <p className="mx-auto mt-3 max-w-[42ch] text-[13px] leading-relaxed text-muted">
          Your notes and progress are still stored. Ask the site admin to restore the account, then sign in again.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            setPending(true)
            try {
              await signOut('password')
            } catch {
              setPending(false)
            }
          }}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-control border border-line-strong bg-surface px-4 text-[13px] font-medium text-fg hover:bg-surface-2 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Sign out'}
        </button>
        {me.data?.user.username && <p className="mt-4 text-[11.5px] text-faint">Signed in as @{me.data.user.username}</p>}
      </div>
    </Frame>
  )
}
