import { BarChart3, BookOpen, FileText, Flame, FolderOpen, Settings as SettingsIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'

import { useMe } from '../lib/api'
import { cx } from '../lib/cx'
import { LegalFooter } from './LegalFooter'
import { Brand, NavBar } from './SiteNav'
import { Avatar } from './ui'

/** Kept as a named `Logo` for the policy and sign-in pages. */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Brand />
    </div>
  )
}

const navItems = [
  { label: 'Library', to: '/', end: true },
  { label: 'Notes', to: '/notes' },
  { label: 'Resources', to: '/resources' },
  { label: 'Quizzes', to: '/quizzes' },
]

export function Shell() {
  const { data: me } = useMe()
  const name = me?.user.name ?? me?.user.email ?? 'You'

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-[14px] focus:font-medium focus:shadow-card"
      >
        Skip to content
      </a>

      <NavBar
        items={navItems}
        className="border-b border-line/70"
        mobileFooter={
          <>
            <NavLink to="/stats" className="flex h-11 items-center gap-2.5 rounded-control px-3 text-[14px] font-medium text-muted hover:bg-surface-2 hover:text-fg-deep">
              <BarChart3 className="size-4" aria-hidden />
              Progress
            </NavLink>
            <NavLink to="/settings" className="flex h-11 items-center gap-2.5 rounded-control px-3 text-[14px] font-medium text-muted hover:bg-surface-2 hover:text-fg-deep">
              <SettingsIcon className="size-4" aria-hidden />
              Settings
            </NavLink>
          </>
        }
        right={
          <>
            {me && me.streak > 0 && (
              <Link
                to="/stats"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-warning-soft px-3 text-[12.5px] font-semibold text-warning transition-transform hover:-translate-y-px"
              >
                <Flame className="size-3.5" aria-hidden />
                {me.streak}
              </Link>
            )}
            <NavLink
              to="/stats"
              className={({ isActive }) =>
                cx(
                  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
                  isActive ? 'bg-accent-soft text-accent-deep' : 'text-muted hover:bg-surface-2 hover:text-fg-deep',
                )
              }
            >
              Progress
            </NavLink>
            <NavLink to="/settings" aria-label="Settings" className="ml-1 grid size-9 place-items-center rounded-full ring-1 ring-line transition-shadow hover:ring-accent/40">
              {me ? <Avatar name={name} hue={218} src={me.user.picture} size={32} /> : <span className="size-8 rounded-full bg-surface-2" />}
            </NavLink>
          </>
        }
      />

      <main id="main" className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-7 sm:px-8 sm:pb-12 sm:pt-9">
        <Outlet />
      </main>

      <LegalFooter />

      {/* Mobile keeps a fixed tab bar for the three places people return to,
          while the drawer in the header carries the rest. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-[rgb(247_251_255/0.94)] px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-4">
          {[
            { to: '/', end: true, label: 'Library', icon: BookOpen },
            { to: '/notes', label: 'Notes', icon: FileText },
            { to: '/resources', label: 'Resources', icon: FolderOpen },
            { to: '/stats', label: 'Progress', icon: BarChart3 },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex h-12 flex-col items-center justify-center gap-1 rounded-control text-[10.5px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cx('size-[17px]', isActive && 'text-accent')} aria-hidden />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

/** Full-screen frame for study modes: a slim header with a way out. */
export function StudyFrame({ title, progress, onExit, children, right }: { title: string; progress?: number; onExit: () => void; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[920px] items-center gap-4 px-5 sm:px-8">
          <button type="button" onClick={onExit} className="inline-flex h-9 items-center rounded-control px-3 text-[14px] font-medium text-muted transition-colors hover:bg-surface hover:text-fg">
            Exit
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-[14px] font-medium">{title}</p>
          <div className="flex min-w-[64px] justify-end">{right}</div>
        </div>
        {progress !== undefined && (
          <div className="mx-auto h-1 max-w-[920px] px-5 sm:px-8">
            <div className="h-full overflow-hidden rounded-[2px] bg-raised">
              <div className="h-full rounded-[2px] bg-accent transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col px-5 py-8 sm:px-8">{children}</main>
    </div>
  )
}
