import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { BrandMark } from '../components/SiteNav'

const copy: Record<string, { title: string; body: string }> = {
  '/notes': {
    title: 'Sign in to open the notes library',
    body: 'Class notes are only available to signed-in students. Your account is what keeps the archive read-only and your progress private.',
  },
  '/resources': {
    title: 'Sign in to open your resources',
    body: 'The class decks and their progress belong to a signed-in account, so this page needs a session first.',
  },
  '/quizzes': {
    title: 'Sign in to practise',
    body: 'Practice runs on the decks in your library. Sign in and pick a deck to work through.',
  },
}

/**
 * Shown when a signed-out visitor opens an app route instead of the landing
 * page. The URL keeps the route they asked for, and one click gets them back.
 */
export function SignedOut() {
  const { pathname } = useLocation()
  const entry = copy[pathname] ?? {
    title: 'Sign in to continue',
    body: 'This part of MyClassroom belongs to a signed-in account.',
  }
  const target = `${pathname}${window.location.search}`
  const signIn = `/signin?returnTo=${encodeURIComponent(target)}`

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(120%_80%_at_50%_-10%,#ffffff_0%,#eaf4ff_34%,#dcecfc_62%,#cfe3f8_100%)] px-5 py-12">
      <div className="w-full max-w-[520px] rounded-panel border border-line/80 bg-surface/85 p-7 shadow-elevated backdrop-blur-xl sm:p-9">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.02em] text-fg-deep">MyClassroom</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-faint">Study library</p>
          </div>
        </div>

        <h1 className="mt-7 font-display text-[26px] font-semibold leading-[1.12] tracking-[-0.02em] text-fg-deep sm:text-[30px]">{entry.title}</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{entry.body}</p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <a
            href={signIn}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-white shadow-[0_16px_30px_-18px_rgb(23_65_159/0.9)] transition-[transform,background-color] hover:-translate-y-px hover:bg-accent-deep sm:flex-1"
          >
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </a>
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-[13.5px] font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Home
          </Link>
        </div>

        <p className="mt-6 inline-flex items-center gap-2 text-[11.5px] text-faint">
          <Lock className="size-3.5 text-accent/70" aria-hidden />
          Read-only for students. Only the admin uploads and edits.
        </p>
      </div>
    </div>
  )
}
