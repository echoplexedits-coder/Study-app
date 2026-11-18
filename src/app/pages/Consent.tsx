import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'

import { DISCLAIMER, LEGAL_PAGES, POLICY_VERSION } from '../../shared/legal'
import { acceptPolicies } from '../lib/api'
import { Logo } from '../components/Shell'

/**
 * Shown after sign-in until the current policy version has been accepted. It is
 * a real gate: the Worker refuses content changes without a stored acceptance
 * (see requireConsent), so dismissing the screen in the browser does nothing.
 */
export function ConsentScreen() {
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [age, setAge] = useState(false)
  const queryClient = useQueryClient()
  const accept = useMutation({
    mutationFn: () => acceptPolicies({ version: POLICY_VERSION, terms, privacy, age }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consent'] }),
  })
  const ready = terms && privacy && age && !accept.isPending

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-[1120px] items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-[620px] px-5 pb-16 sm:px-8">
        <div className="rounded-dialog bg-surface p-6 shadow-card sm:p-8">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-faint">Version {POLICY_VERSION}</p>
          <h1 className="mt-2 text-[26px] font-bold tracking-[-0.02em]">Before you start</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            myclassroom stores your study progress. Only the site admin uploads class material; student accounts are read-only. Please read these and confirm each statement. Nothing is pre-selected.
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <Statement checked={terms} onChange={setTerms}>
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
                Terms of Use
              </a>{' '}
              and the{' '}
              <a href="/acceptable-use" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
                Acceptable Use Policy
              </a>
              .
            </Statement>
            <Statement checked={privacy} onChange={setPrivacy}>
              I have read the{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
                Privacy Policy
              </a>{' '}
              and consent to my account details, study activity and messages being stored and processed as described there.
            </Statement>
            <Statement checked={age} onChange={setAge}>
              I am 18 or older, or I am using myclassroom with the permission of a parent, guardian or teacher who has agreed to this on my behalf.
            </Statement>
          </div>

          <section className="mt-5 rounded-card border border-line bg-surface-2 p-4">
            <h2 className="text-[13px] font-semibold">For parents and guardians</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              A student account keeps the student's name, email address, username, password hash (only if password sign-in is used), student ID and study
              progress. The app does not ask for a date of birth, phone number, postal address or school records. Only the site admin can upload class material.
              A parent or guardian can ask for a copy or deletion through the Contact page.
            </p>
          </section>

          {accept.error && <p className="mt-4 text-[13px] text-danger">{(accept.error as Error).message}</p>}

          <button
            type="button"
            disabled={!ready}
            onClick={() => accept.mutate()}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-control bg-accent text-[14.5px] font-semibold text-white transition-colors hover:bg-accent-deep disabled:pointer-events-none disabled:opacity-50"
          >
            {accept.isPending ? 'Saving…' : 'Accept and continue'}
          </button>
          <p className="mt-4 text-[12px] leading-relaxed text-faint">
            The version you accept and the time are recorded against your account. If these policies change in a material way, you will be asked again. You can
            withdraw consent at any time by deleting your account from Settings → Legal &amp; safety.
          </p>
        </div>

        <p className="mt-6 text-[12px] leading-relaxed text-faint">{DISCLAIMER}</p>
        <nav aria-label="Legal and safety" className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.to} to={page.to} className="text-[12.5px] font-medium text-muted hover:text-fg">
              {page.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}

function Statement({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-card border border-line p-3.5 transition-colors hover:bg-surface-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="text-[13.5px] leading-relaxed text-fg">{children}</span>
    </label>
  )
}
