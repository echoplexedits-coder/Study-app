import { AnimatePresence, motion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'

import { cx } from '../lib/cx'

/* The book mark stays the same shape it has always been, redrawn for the new
   icing: a soft royal tile with an open book cut out of it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cx('relative grid size-9 shrink-0 place-items-center rounded-[12px] bg-accent text-white shadow-[0_6px_16px_-8px_rgb(6_23_51/0.6)]', className)}>
      <span className="absolute inset-0 rounded-[12px] bg-[linear-gradient(150deg,rgb(255_255_255/0.28),transparent_55%)]" aria-hidden />
      <svg viewBox="0 0 24 24" fill="none" className="relative size-[19px]" aria-hidden>
        <path d="M12 6.6C9.9 5.1 7 4.9 4.4 5.7v11.5c2.6-.8 5.5-.5 7.6 1 2.1-1.5 5-1.8 7.6-1V5.7C17 4.9 14.1 5.1 12 6.6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M12 7.4v10.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function Brand({ tone = 'dark', to = '/' }: { tone?: 'dark' | 'light'; to?: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5" aria-label="MyClassroom — home">
      <BrandMark className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.04]" />
      <span className="flex flex-col leading-none">
        <span className={cx('text-[15.5px] font-semibold tracking-[-0.028em]', tone === 'light' ? 'text-white' : 'text-fg-deep')}>
          MyClassroom
        </span>
        <span className={cx('mt-1 text-[9px] font-semibold uppercase tracking-[0.24em]', tone === 'light' ? 'text-ice/70' : 'text-faint')}>
          Study library
        </span>
      </span>
    </Link>
  )
}

export interface NavItem {
  label: string
  /** A route path, matched against the current location for the active pill. */
  to?: string
  /** An in-page anchor, used by the landing page. */
  href?: string
  end?: boolean
}

/** True while the router sits on this item's path. */
function useIsActive() {
  const { pathname } = useLocation()
  return (item: NavItem) => {
    if (item.href) return false
    if (!item.to) return false
    if (item.to === '/') return pathname === '/' || (item.end === true && pathname === '/')
    return item.end ? pathname === item.to : pathname.startsWith(item.to)
  }
}

const linkBase =
  'relative inline-flex h-9 items-center rounded-full px-3.5 text-[13.5px] font-medium tracking-[-0.006em] transition-colors duration-200'

export function NavBar({
  items,
  right,
  sticky = true,
  tone = 'light',
  className,
  mobileFooter,
}: {
  items: NavItem[]
  right?: ReactNode
  sticky?: boolean
  tone?: 'light' | 'dark'
  className?: string
  mobileFooter?: ReactNode
}) {
  const isActive = useIsActive()
  const [open, setOpen] = useState(false)
  const [lifted, setLifted] = useState(false)
  const { pathname } = useLocation()

  // The bar is transparent over the hero and gains a hairline once the page
  // moves. The listener only sets state when the threshold is crossed.
  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 8
      setLifted((current) => (current === next ? current : next))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A route change always closes the mobile panel.
  useEffect(() => setOpen(false), [pathname])

  return (
    <header
      className={cx(
        'z-40 w-full',
        sticky && 'sticky top-0',
        tone === 'light' ? 'text-fg' : 'text-white',
        'transition-[background-color,box-shadow,border-color] duration-300',
        lifted
          ? tone === 'light'
            ? 'border-b border-line/80 bg-[rgb(247_251_255/0.82)] shadow-[0_1px_0_rgb(255_255_255/0.6)_inset,0_18px_40px_-34px_rgb(6_23_51/0.5)] backdrop-blur-xl'
            : 'border-b border-white/10 bg-[rgb(6_23_51/0.72)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
        className,
      )}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1180px] items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-8">
        <Brand tone={tone === 'dark' ? 'light' : 'dark'} />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {items.map((item) => {
            const active = isActive(item)
            const classes = cx(
              linkBase,
              active
                ? tone === 'light'
                  ? 'text-fg-deep'
                  : 'text-white'
                : tone === 'light'
                  ? 'text-muted hover:text-fg-deep'
                  : 'text-white/65 hover:text-white',
            )
            if (item.href) {
              return (
                <a key={item.label} href={item.href} className={cx(classes, 'group')}>
                  <span className="relative z-10">{item.label}</span>
                  <span className="absolute inset-x-3.5 bottom-1.5 h-px origin-left scale-x-0 bg-current opacity-40 transition-transform duration-300 group-hover:scale-x-100" aria-hidden />
                </a>
              )
            }
            return (
              <Link key={item.label} to={item.to ?? '/'} className={classes} aria-current={active ? 'page' : undefined}>
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className={cx('absolute inset-0 rounded-full', tone === 'light' ? 'bg-accent-soft/80 ring-1 ring-accent/10' : 'bg-white/12')}
                    transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.7 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          {right && <div className="hidden items-center gap-2 md:flex">{right}</div>}
          <button
            type="button"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className={cx(
              'grid size-9 place-items-center rounded-full border transition-colors md:hidden',
              tone === 'light' ? 'border-line bg-surface/70 text-fg' : 'border-white/20 bg-white/10 text-white',
            )}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className={cx('overflow-hidden border-t md:hidden', tone === 'light' ? 'border-line bg-[rgb(247_251_255/0.97)]' : 'border-white/10 bg-night')}
          >
            <nav className="mx-auto grid max-w-[1180px] gap-1 px-5 py-4" aria-label="Primary mobile">
              {items.map((item) => {
                const active = isActive(item)
                const classes = cx(
                  'flex h-11 items-center justify-between rounded-control px-3 text-[14px] font-medium transition-colors',
                  active
                    ? tone === 'light'
                      ? 'bg-accent-soft text-accent-deep'
                      : 'bg-white/12 text-white'
                    : tone === 'light'
                      ? 'text-muted hover:bg-surface-2 hover:text-fg-deep'
                      : 'text-white/70 hover:bg-white/8 hover:text-white',
                )
                return item.href ? (
                  <a key={item.label} href={item.href} className={classes} onClick={() => setOpen(false)}>
                    {item.label}
                  </a>
                ) : (
                  <Link key={item.label} to={item.to ?? '/'} className={classes} aria-current={active ? 'page' : undefined}>
                    {item.label}
                  </Link>
                )
              })}
              {mobileFooter && <div className="mt-2 grid gap-2 border-t border-line/70 pt-3">{mobileFooter}</div>}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
