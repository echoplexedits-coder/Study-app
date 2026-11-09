import { ArrowRight, ArrowUpRight, BookOpen, FileText, FolderOpen, GraduationCap, LayoutGrid, Layers, Lock, Search, Sparkles, UsersRound, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'

import { CONTACT_EMAIL, DISCLAIMER, LEGAL_PAGES } from '../../shared/legal'
import { useAuthStatus, usePublicLibrary } from '../lib/api'
import { NavBar } from '../components/SiteNav'
import '../../welcome.css'

const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'Notes', href: '#notes' },
  { label: 'Resources', href: '#resources' },
  { label: 'Quizzes', href: '#quizzes' },
  { label: 'About', href: '#about' },
]

const features = [
  {
    icon: FileText,
    title: 'Class Notes',
    copy: 'Every handout, slide deck and chapter summary the class has been given, kept in one library instead of a group chat.',
  },
  {
    icon: Search,
    title: 'Quick Access',
    copy: 'Search by name, then narrow to your class or subject. Open a document in a preview, or download it for offline revision.',
  },
  {
    icon: UsersRound,
    title: 'Made for Students',
    copy: 'A read-only library for students. No uploading, no editing, nothing to break — just the material you were given.',
  },
]

const steps = [
  {
    n: '01',
    title: 'A teacher or admin uploads',
    copy: 'Documents are added from the admin workspace and filed under a class, a subject and a date as they arrive.',
  },
  {
    n: '02',
    title: 'The library organises itself',
    copy: 'Each upload is grouped by class and subject, so the archive stays readable as the term goes on instead of becoming a folder of loose files.',
  },
  {
    n: '03',
    title: 'Students read and download',
    copy: 'Sign in and the notes are there: preview a PDF, open an image, or download the file you need before class.',
  },
]

const practice = [
  { icon: Layers, title: 'Flashcards', copy: 'Flip through a deck at your own pace.' },
  { icon: GraduationCap, title: 'Learn', copy: 'Answer each card as a multiple-choice question.' },
  { icon: LayoutGrid, title: 'Match', copy: 'Pair terms with answers against the clock.' },
]

const benefits = [
  {
    icon: Zap,
    title: 'Convenience',
    copy: 'The material lives where you already are. No asking around for the handout that was shared three weeks ago.',
  },
  {
    icon: FolderOpen,
    title: 'Accessibility',
    copy: 'Readable type, keyboard-friendly controls and layouts that hold up on a phone as well as a desktop monitor.',
  },
  {
    icon: BookOpen,
    title: 'Organised learning',
    copy: 'Notes stay attached to the class and subject they belong to, so revision starts with finding things, not hunting for them.',
  },
]

/** Every way in now starts from one page: Google, Freebuff or a username. */
function signInHref(_google: boolean, returnTo: string) {
  return `/signin?returnTo=${encodeURIComponent(returnTo)}`
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function kindOf(contentType: string | null) {
  if (!contentType) return 'File'
  if (contentType.startsWith('image/')) return 'Image'
  if (contentType === 'application/pdf') return 'PDF'
  if (contentType.includes('word')) return 'Document'
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return 'Slides'
  if (contentType.includes('sheet') || contentType.includes('excel') || contentType === 'text/csv') return 'Sheet'
  if (contentType.startsWith('text/')) return 'Text'
  return 'File'
}

const ease = [0.22, 1, 0.36, 1] as const

export function Welcome() {
  const auth = useAuthStatus()
  const library = usePublicLibrary()
  const path = `${window.location.pathname}${window.location.search}`
  const returnTo = path === '/welcome' ? '/' : path
  const signIn = signInHref(auth.data?.google === true, returnTo)

  useEffect(() => {
    const previous = document.title
    document.title = 'MyClassroom — Your notes. Anytime.'
    return () => {
      document.title = previous
    }
  }, [])

  return (
    <div className="land">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-[13.5px] focus:font-medium focus:shadow-card"
      >
        Skip to content
      </a>

      <div className="land-field" aria-hidden>
        <span className="land-orb land-orb--one" />
        <span className="land-orb land-orb--two" />
        <span className="land-orb land-orb--three" />
        <span className="land-grid" />
        <span className="land-grain" />
      </div>

      <NavBar
        items={navItems}
        mobileFooter={
          <>
            <a href={signIn} className="land-mobile-cta">
              Sign in <ArrowRight className="size-4" />
            </a>
            <p className="px-3 text-[12px] leading-relaxed text-faint">A read-only study library for students.</p>
          </>
        }
        right={
          <>
            <a href={signIn} className="land-nav-signin">
              Sign In
            </a>
            <a href={signIn} className="land-nav-cta">
              Get Started
              <ArrowRight className="size-3.5" />
            </a>
          </>
        }
      />

      <main id="main" className="land-main">
        <section id="home" className="land-sheet-wrap">
          <div className="land-sheet">
            <span className="land-sheet-sheen" aria-hidden />

            <div className="land-hero">
              <div className="land-hero-copy">
                <motion.p className="land-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.05 }}>
                  <span>Learn</span>
                  <i aria-hidden />
                  <span>Access</span>
                  <i aria-hidden />
                  <span>Achieve</span>
                </motion.p>

                <motion.h1 className="land-title" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay: 0.12 }}>
                  MYCLASSROOM
                </motion.h1>

                <motion.p className="land-tagline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.24 }}>
                  Your notes. Anytime.
                </motion.p>

                <motion.p className="land-lede" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.32 }}>
                  A digital library for the notes your class has been given. Browse by class and subject, preview a document, and
                  download what you need — without chasing a group chat.
                </motion.p>

                <motion.div className="land-actions" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease, delay: 0.4 }}>
                  <a href={signIn} className="land-cta">
                    <span>Get Started</span>
                    <ArrowRight className="size-4" aria-hidden />
                  </a>
                  <a href="#notes" className="land-cta-ghost">
                    Explore the library
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </motion.div>

                <motion.p className="land-fineprint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.55 }}>
                  <Lock className="size-3.5" aria-hidden />
                  Students read. Only the admin uploads and edits.
                </motion.p>
              </div>

              <motion.div className="land-hero-art" initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 1, ease, delay: 0.18 }} aria-hidden>
                <HeroArt />
              </motion.div>
            </div>

            <div className="land-cards">
              {features.map(({ icon: Icon, title, copy }, i) => (
                <motion.article
                  key={title}
                  className="land-card"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.5, ease, delay: i * 0.06 }}
                >
                  <span className="land-card-icon">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </motion.article>
              ))}
            </div>

            <motion.div
              className="land-panel"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease }}
            >
              <span className="land-panel-dots" aria-hidden />
              <div className="land-panel-copy">
                <p className="land-panel-eyebrow">Secure &amp; Reliable</p>
                <h2>Your account, your progress, kept apart.</h2>
                <p>
                  Sign-in runs through a real identity provider, and study progress is stored per person. Class material is served
                  read-only, so a student account can never add, change or remove a document.
                </p>
                <a href={signIn} className="land-panel-cta">
                  Open your library
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              </div>
              <div className="land-panel-figure" aria-hidden>
                <div className="land-figure-sheet">
                  <span className="land-figure-line land-figure-line--wide" />
                  <span className="land-figure-line" />
                  <span className="land-figure-line land-figure-line--short" />
                  <div className="land-figure-rows">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="land-figure-sheet land-figure-sheet--back" />
              </div>
            </motion.div>
          </div>
        </section>

        <section id="notes" className="land-section land-notes">
          <div className="land-wrap land-section-grid">
            <div>
              <p className="land-kicker">The notes library</p>
              <h2 className="land-h2">Built to be searched, not scrolled.</h2>
              <p className="land-body">
                The library is the centre of MyClassroom. Documents are filed by the class and subject they belong to, and the page
                is a working archive: search, filter, preview, download.
              </p>
              <ul className="land-list">
                <li>
                  <Search className="size-4" aria-hidden />
                  <span>
                    <strong>Search across the archive</strong>
                    Match on a document name, then narrow it to a class or subject.
                  </span>
                </li>
                <li>
                  <FileText className="size-4" aria-hidden />
                  <span>
                    <strong>Preview before you commit</strong>
                    Images open in the page and PDFs open in a viewer, so you know it is the right handout first.
                  </span>
                </li>
                <li>
                  <Lock className="size-4" aria-hidden />
                  <span>
                    <strong>Read-only by design</strong>
                    Only the site admin can upload or delete. Permissions are enforced by the server, not by a hidden button.
                  </span>
                </li>
              </ul>
              <a href={signIn} className="land-inline-cta">
                Sign in to browse
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
            <div className="land-notes-figure" aria-hidden>
              <div className="land-notes-bar">
                <span className="land-notes-search">
                  <Search className="size-3.5" />
                  <span>Search notes</span>
                </span>
                <span className="land-notes-filter" />
                <span className="land-notes-filter land-notes-filter--short" />
              </div>
              <div className="land-notes-split">
                <div className="land-notes-rows">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="land-notes-row" style={{ animationDelay: `${i * 0.6}s` }}>
                      <i />
                      <b />
                    </span>
                  ))}
                </div>
                <div className="land-notes-preview">
                  <span className="land-notes-page">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="land-section land-how">
          <div className="land-wrap">
            <p className="land-kicker">How it works</p>
            <h2 className="land-h2">Three quiet steps, every term.</h2>
            <div className="land-steps">
              {steps.map((step, i) => (
                <motion.article
                  key={step.n}
                  className="land-step"
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.5, ease, delay: i * 0.08 }}
                >
                  <span className="land-step-n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section land-latest">
          <div className="land-wrap">
            <div className="land-latest-head">
              <div>
                <p className="land-kicker">Latest resources</p>
                <h2 className="land-h2">What is in the library right now.</h2>
              </div>
              <p className="land-latest-note">
                {library.data && library.data.notes > 0
                  ? `${library.data.notes} ${library.data.notes === 1 ? 'document' : 'documents'} across ${library.data.subjects || 1} ${library.data.subjects === 1 ? 'subject' : 'subjects'}.`
                  : 'A live view of the archive — never sample data.'}
              </p>
            </div>

            {library.isLoading && (
              <div className="land-latest-list" aria-busy>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="land-latest-row land-latest-row--skeleton" />
                ))}
              </div>
            )}

            {!library.isLoading && library.data && library.data.recent.length > 0 && (
              <div className="land-latest-list">
                {library.data.recent.map((item, i) => (
                  <motion.div
                    key={`${item.name}-${item.uploadedAt}`}
                    className="land-latest-row"
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.45, ease, delay: i * 0.06 }}
                  >
                    <span className="land-latest-kind">{kindOf(item.contentType)}</span>
                    <span className="land-latest-body">
                      <strong>{item.name}</strong>
                      <span>{[item.subject, item.className].filter(Boolean).join(' · ') || 'Class material'}</span>
                    </span>
                    <span className="land-latest-date">{formatDate(item.uploadedAt)}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {!library.isLoading && (!library.data || library.data.recent.length === 0) && (
              <div className="land-latest-empty">
                <BookOpen className="size-5" aria-hidden />
                <p>The archive is empty today. Sign in — new notes appear here the moment they are uploaded.</p>
              </div>
            )}
          </div>
        </section>

        <section id="resources" className="land-section land-resources">
          <div className="land-wrap land-section-grid land-section-grid--reverse">
            <div className="land-resource-cards">
              <article className="land-resource-card">
                <span className="land-resource-icon">
                  <Layers className="size-[18px]" aria-hidden />
                </span>
                <h3>Study decks</h3>
                <p>Read a topic as a deck of cards, one idea at a time, with its own progress tracked separately.</p>
              </article>
              <article className="land-resource-card">
                <span className="land-resource-icon">
                  <FileText className="size-[18px]" aria-hidden />
                </span>
                <h3>Attached files</h3>
                <p>A diagram or handout stays attached to the card it explains, so it is never a separate hunt.</p>
              </article>
              <article className="land-resource-card">
                <span className="land-resource-icon">
                  <Zap className="size-[18px]" aria-hidden />
                </span>
                <h3>Progress</h3>
                <p>Cards studied, accuracy and streaks are kept per account, so the numbers are yours alone.</p>
              </article>
            </div>
            <div>
              <p className="land-kicker">Resources</p>
              <h2 className="land-h2">A small toolkit. Not a maze.</h2>
              <p className="land-body">
                Everything that is not the notes themselves sits beside them: the class decks, the files attached to your cards,
                and the small set of numbers that tell you what to revise next.
              </p>
              <a href={signIn} className="land-inline-cta">
                See your resources
                <ArrowRight className="size-4" aria-hidden />
              </a>
            </div>
          </div>
        </section>

        <section id="quizzes" className="land-section land-quiz">
          <div className="land-wrap">
            <div className="land-quiz-head">
              <div>
                <p className="land-kicker">Quizzes</p>
                <h2 className="land-h2">Practice, when you want it.</h2>
              </div>
              <p className="land-quiz-note">
                Quizzes are a second feature, not the front door. They sit inside a deck you are already reading — nothing to set
                up, nothing to configure.
              </p>
            </div>
            <div className="land-practice">
              {practice.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="land-practice-card">
                  <Icon className="size-[17px]" aria-hidden />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="land-section land-benefits">
          <div className="land-wrap">
            <p className="land-kicker">Why it exists</p>
            <h2 className="land-h2">Convenience, accessibility, order.</h2>
            <div className="land-benefit-grid">
              {benefits.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="land-benefit">
                  <span className="land-benefit-icon">
                    <Icon className="size-[17px]" aria-hidden />
                  </span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="land-section land-about">
          <div className="land-wrap">
            <div className="land-about-card">
              <p className="land-kicker">About</p>
              <h2 className="land-h2">What this is.</h2>
              <p className="land-body">
                MyClassroom is an independent study tool. Class notes are kept as a searchable library, decks add a way to work
                through a topic, and each person's progress is held separately from everyone else's.
              </p>
              <p className="land-body">
                It is built and run by an individual developer — not by a school, college, coaching centre or board. Material is
                uploaded by the person who runs this site and is not checked, approved or endorsed by any institution.
              </p>
              <p className="land-body land-body--muted">
                Questions, takedowns and privacy requests go through the <Link to="/contact">contact page</Link>, or by email to{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
              <div className="land-about-tags">
                <span>
                  <Sparkles className="size-3.5" aria-hidden />
                  Independent
                </span>
                <span>
                  <Lock className="size-3.5" aria-hidden />
                  Private by default
                </span>
                <span>
                  <UsersRound className="size-3.5" aria-hidden />
                  Read-only for students
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="land-footer">
        <div className="land-wrap">
          <div className="land-footer-grid">
            <div className="land-footer-brand">
              <span className="land-footer-mark" aria-hidden>
                <BookOpen className="size-4" />
              </span>
              <p className="land-footer-name">MyClassroom</p>
              <p className="land-footer-copy">A read-only class notes library, built for students who would rather revise than search.</p>
            </div>
            <nav aria-label="Platform">
              <h2>Platform</h2>
              <a href="#home">Home</a>
              <a href="#notes">Class notes</a>
              <a href="#resources">Resources</a>
              <a href="#quizzes">Quizzes</a>
            </nav>
            <nav aria-label="Support">
              <h2>Support</h2>
              <Link to="/contact">Contact</Link>
              <a href={`mailto:${CONTACT_EMAIL}`}>Email the operator</a>
              <a href={signIn}>Sign in</a>
            </nav>
            <nav aria-label="Legal">
              <h2>Legal</h2>
              {LEGAL_PAGES.filter((page) => page.to !== '/contact').map((page) => (
                <Link key={page.to} to={page.to}>
                  {page.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="land-footer-base">
            <p>{DISCLAIMER}</p>
            <p className="land-footer-sign">MyClassroom · study smarter</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ---------------------------------------------------------------------------
   The centrepiece. It is one inline SVG: a crystal open book with a
   graduation cap floating above it, rings of ice behind, and a soft grounded
   reflection. All motion is CSS transforms on three groups, so the browser
   animates it on the compositor and no frame runs JavaScript.
   ------------------------------------------------------------------------- */
function HeroArt() {
  return (
    <div className="land-art">
      <span className="land-art-halo" aria-hidden />
      <svg viewBox="0 0 620 540" className="land-art-svg" role="img" aria-label="A crystal open book with a graduation cap floating above it, lit from within">
        <defs>
          <linearGradient id="la-page-l" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset="0.45" stopColor="#e8f4ff" />
            <stop offset="1" stopColor="#b9d9f6" />
          </linearGradient>
          <linearGradient id="la-page-r" x1="0.9" y1="0" x2="0.1" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#dcefff" />
            <stop offset="1" stopColor="#a9cdf1" />
          </linearGradient>
          <linearGradient id="la-cover" x1="0" y1="0" x2="0.6" y2="1">
            <stop stopColor="#2f68c9" />
            <stop offset="0.42" stopColor="#17419f" />
            <stop offset="1" stopColor="#0a2361" />
          </linearGradient>
          <linearGradient id="la-cover-dark" x1="0" y1="0" x2="0.5" y2="1">
            <stop stopColor="#12306f" />
            <stop offset="1" stopColor="#061733" />
          </linearGradient>
          <linearGradient id="la-cap" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop stopColor="#5b9be8" />
            <stop offset="0.45" stopColor="#24558f" />
            <stop offset="1" stopColor="#0b2a63" />
          </linearGradient>
          <linearGradient id="la-cap-top" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop stopColor="#8fc4f5" />
            <stop offset="0.35" stopColor="#2f6bbf" />
            <stop offset="1" stopColor="#10306f" />
          </linearGradient>
          <linearGradient id="la-tassel" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#ffe8a8" />
            <stop offset="0.5" stopColor="#e9c265" />
            <stop offset="1" stopColor="#b98f2c" />
          </linearGradient>
          <linearGradient id="la-crystal" x1="0" y1="0" x2="0.8" y2="1">
            <stop stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#c9e4fb" />
            <stop offset="0.75" stopColor="#7cb4e8" />
            <stop offset="1" stopColor="#3c79b8" />
          </linearGradient>
          <radialGradient id="la-glow" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#7dc0f8" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#a8d6ff" stopOpacity="0.22" />
            <stop offset="1" stopColor="#cfe8ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="la-floor" cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="#0a2361" stopOpacity="0.22" />
            <stop offset="1" stopColor="#0a2361" stopOpacity="0" />
          </radialGradient>
          <filter id="la-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="la-tight" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0a2361" floodOpacity="0.22" />
          </filter>
        </defs>

        <ellipse cx="310" cy="270" rx="250" ry="220" fill="url(#la-glow)" />

        <g className="land-crystal">
          <path d="M104 402 140 246 178 404Z" fill="url(#la-crystal)" opacity="0.55" />
          <path d="m140 246 38 158-20-24Z" fill="#ffffff" opacity="0.5" />
          <path d="M176 408 202 300 236 410Z" fill="url(#la-crystal)" opacity="0.35" />
          <path d="M452 404 486 262 520 406Z" fill="url(#la-crystal)" opacity="0.42" />
          <path d="m486 262 34 144-16-26Z" fill="#ffffff" opacity="0.45" />
          <path d="M524 412 546 330 570 414Z" fill="url(#la-crystal)" opacity="0.25" />
        </g>

        <g filter="url(#la-tight)">
          <g className="land-cap">
            <path d="M310 96 214 140 310 184 406 140Z" fill="url(#la-cap-top)" />
            <path d="M310 96 214 140 310 184Z" fill="#ffffff" opacity="0.16" />
            <path d="M310 96 406 140 310 184Z" fill="#061733" opacity="0.12" />
            <path d="M222 146 310 188 398 146 398 170C360 198 260 198 222 170Z" fill="url(#la-cap)" />
            <path d="M222 146 310 188 398 146" stroke="#a8cef3" strokeWidth="1.1" opacity="0.55" />
            <ellipse cx="310" cy="150" rx="4" ry="2.6" fill="#dbeaf9" />
            <path d="M313 151c22 8 32 34 36 62" stroke="url(#la-tassel)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path d="m349 213 5 20 7-18 5 22 4-20" stroke="url(#la-tassel)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M310 96 214 140 310 184 406 140Z" stroke="#cfe4f8" strokeWidth="0.9" opacity="0.5" fill="none" />
          </g>
        </g>

        <ellipse cx="310" cy="404" rx="196" ry="30" fill="#0a2361" opacity="0.14" filter="url(#la-soft)" />

        {/* A soft column of light ties the cap to the open pages. */}
        <path d="M268 206h84l46 148c-58 26-118 26-176 0Z" fill="url(#la-glow)" opacity="0.5" />
        <path d="M300 210h20l10 150c-14 4-26 4-40 0Z" fill="#ffffff" opacity="0.16" />

        <g className="land-book">
          <g filter="url(#la-tight)">
            <path d="M302 300C244 276 172 280 116 308v18c56-28 128-32 186-8Z" fill="url(#la-cover-dark)" />
            <path d="M318 300c58-24 130-20 186 8v18c-56-28-128-32-186-8Z" fill="url(#la-cover-dark)" />
            <path d="M302 300C244 276 172 280 116 308l-4 104c56-30 128-34 190-10Z" fill="url(#la-cover)" />
            <path d="M318 300c58-24 130-20 186 8l4 104c-56-30-128-34-190-10Z" fill="url(#la-cover)" />
            <path d="M306 302C252 282 184 286 130 312v96c54-26 122-30 176-10Z" fill="url(#la-page-l)" />
            <path d="M314 302c54-20 122-16 176 10v96c-54-26-122-30-176-10Z" fill="url(#la-page-r)" />
            <path d="M306 302C252 282 184 286 130 312" stroke="#ffffff" strokeWidth="1.6" opacity="0.9" fill="none" />
            <path d="M314 302c54-20 122-16 176 10" stroke="#ffffff" strokeWidth="1.6" opacity="0.85" fill="none" />
            <path d="M146 330c44-18 100-16 148 2M146 352c44-18 100-16 148 2M146 374c44-18 100-16 148 2M146 396c40-16 92-15 136 0" stroke="#8fb8dc" strokeWidth="1" opacity="0.5" fill="none" />
            <path d="M474 330c-44-18-100-16-148 2M474 352c-44-18-100-16-148 2M474 374c-44-18-100-16-148 2M474 396c-40-16-92-15-136 0" stroke="#8fb8dc" strokeWidth="1" opacity="0.45" fill="none" />
            <path d="M310 296v112" stroke="#0b2a63" strokeWidth="7" opacity="0.35" />
            <path d="M310 296v112" stroke="#eaf5ff" strokeWidth="1.4" opacity="0.9" />
            {/* Page block: a few edges under the front cover read as thickness. */}
            <path d="M130 414c56-26 122-30 176-10" stroke="#cfe4f8" strokeWidth="3" opacity="0.55" fill="none" />
            <path d="M130 420c56-26 122-30 176-10" stroke="#a9cdf1" strokeWidth="2" opacity="0.4" fill="none" />
            <path d="M490 414c-56-26-122-30-176-10" stroke="#cfe4f8" strokeWidth="3" opacity="0.5" fill="none" />
            <path d="M490 420c-56-26-122-30-176-10" stroke="#a9cdf1" strokeWidth="2" opacity="0.35" fill="none" />
            {/* The ribbon marker hangs out of the spine. */}
            <path d="M303 402h13l-2 36-4.5-6-6.5 6Z" fill="url(#la-tassel)" opacity="0.92" />
            <path d="M302 300C244 276 172 280 116 308l-4 104c56-30 128-34 190-10" stroke="#cfe4f8" strokeWidth="1.6" opacity="0.6" fill="none" />
            <path d="M318 300c58-24 130-20 186 8l4 104c-56-30-128-34-190-10" stroke="#cfe4f8" strokeWidth="1.6" opacity="0.55" fill="none" />
          </g>
        </g>

        <g className="land-motes" fill="#ffffff">
          <circle cx="196" cy="196" r="2.4" opacity="0.85" />
          <circle cx="436" cy="228" r="2" opacity="0.7" />
          <circle cx="470" cy="150" r="1.6" opacity="0.55" />
          <circle cx="150" cy="252" r="1.8" opacity="0.6" />
          <circle cx="352" cy="120" r="1.5" opacity="0.5" />
        </g>

        <ellipse cx="310" cy="470" rx="150" ry="16" fill="url(#la-floor)" className="land-book-reflection" />
      </svg>
    </div>
  )
}
