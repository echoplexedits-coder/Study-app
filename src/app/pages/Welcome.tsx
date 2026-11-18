import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutGrid,
  Layers,
  Lock,
  Search,
  Sparkles,
  UsersRound,
  Zap,
} from 'lucide-react'

import { CONTACT_EMAIL, DISCLAIMER, LEGAL_PAGES } from '../../shared/legal'

const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'The library', href: '#library' },
  { label: "What's inside", href: '#inside' },
  { label: 'Practice', href: '#quizzes' },
  { label: 'About', href: '#about' },
]

const features = [
  {
    icon: FileText,
    title: 'Class notes first',
    copy: 'Handouts, slide decks and chapter summaries in one archive, instead of a group chat you have to scroll back through.',
  },
  {
    icon: Search,
    title: 'Search and preview',
    copy: 'Search by name, narrow by class or subject, then preview the document before you download it for offline revision.',
  },
  {
    icon: Layers,
    title: 'Practice beside them',
    copy: 'Flashcards, a multiple-choice Learn mode and Match sit beside the notes for when reading is not enough.',
  },
]

const steps = [
  {
    n: '01',
    title: 'The admin uploads',
    copy: 'Files are added from the admin workspace and filed under a class, a subject and a date. Student accounts cannot upload or edit.',
  },
  {
    n: '02',
    title: 'The library files it',
    copy: 'Each document is grouped by class and subject, so the archive stays readable as the term goes on instead of becoming a pile of loose files.',
  },
  {
    n: '03',
    title: 'Students search and study',
    copy: 'Sign in to preview a PDF, open an image or download a file — then switch to a deck when you want to practise.',
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

/**
 * The landing page is rendered on the server for signed-out visitors, so it
 * deliberately uses no hooks, no router context and no browser globals.
 */
export function Welcome() {
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

      <header className="land-header">
        <div className="land-nav">
          <a href="/" className="land-brand" aria-label="MyClassroom — home">
            <span className="land-brand-mark" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" className="size-[19px]">
                <path
                  d="M12 6.6C9.9 5.1 7 4.9 4.4 5.7v11.5c2.6-.8 5.5-.5 7.6 1 2.1-1.5 5-1.8 7.6-1V5.7C17 4.9 14.1 5.1 12 6.6Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path d="M12 7.4v10.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="land-brand-text">
              <span className="land-brand-name">MyClassroom</span>
              <span className="land-brand-sub">Study library</span>
            </span>
          </a>

          <nav className="land-nav-links" aria-label="Primary">
            {navItems.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="land-nav-actions">
            <a href="/signin" className="land-nav-signin">
              Sign in
            </a>
            <a href="/signin" className="land-nav-cta">
              Open library
              <ArrowRight className="size-3.5" aria-hidden />
            </a>
          </div>

          <details className="land-menu">
            <summary>Menu</summary>
            <nav className="land-menu-panel" aria-label="Mobile">
              {navItems.map((item) => (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ))}
              <a href="/signin" className="land-menu-signin">
                Sign in
              </a>
            </nav>
          </details>
        </div>
      </header>

      <main id="main" className="land-main">
        <section id="home" className="land-sheet-wrap">
          <div className="land-sheet">
            <span className="land-sheet-sheen" aria-hidden />

            <div className="land-hero">
              <div className="land-hero-copy">
                <h1 className="land-title">Your class notes, in one place.</h1>

                <p className="land-tagline">Find the handout. Skip the group chat.</p>

                <p className="land-lede">
                  A searchable library of your class notes — handouts, slide decks and chapter summaries, filed by class and
                  subject. Flashcards and quizzes sit beside them when you want to practise.
                </p>

                <div className="land-actions">
                  <a href="/signin" className="land-cta">
                    <span>Open the library</span>
                    <ArrowRight className="size-4" aria-hidden />
                  </a>
                  <a href="#inside" className="land-cta-ghost">
                    See what&apos;s inside
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </div>

                <p className="land-fineprint">
                  <Lock className="size-3.5" aria-hidden />
                  Only the site admin uploads and edits. Student accounts are read-only.
                </p>

                <p className="land-upload-note">
                  Class material is uploaded only by the site admin, and only where they have the right to share it. Rights
                  holders can request removal through the <a href="/copyright">Copyright page</a>.
                </p>
              </div>

              <figure className="land-hero-art land-mock-figure">
                <LibraryMockup />
                <figcaption className="land-mock-caption">
                  Illustration: search the notes library, then preview a document.
                </figcaption>
              </figure>
            </div>

            <div className="land-cards">
              {features.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="land-card">
                  <span className="land-card-icon">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <h2>{title}</h2>
                  <p>{copy}</p>
                </article>
              ))}
            </div>

            <div className="land-panel">
              <span className="land-panel-dots" aria-hidden />
              <div className="land-panel-copy">
                <p className="land-panel-eyebrow">Accounts and permissions</p>
                <h2>Google sign-in. Admin-only uploads. Checked on the server.</h2>
                <p>
                  Sign in with Google, or with a username and password. Every upload, edit and delete goes through an admin-only
                  route that checks the account&apos;s role on the server, so a student account cannot change class material.
                </p>
                <a href="/signin" className="land-panel-cta">
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
            </div>
          </div>
        </section>

        <section id="library" className="land-section land-notes">
          <div className="land-wrap land-section-grid">
            <div>
              <p className="land-kicker">The notes library</p>
              <h2 className="land-h2">Built to be searched, not scrolled.</h2>
              <p className="land-body">
                The library is the centre of MyClassroom. Documents are filed by the class and subject they belong to, and the
                page works like an archive: search, filter, preview, download.
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
                    <strong>Read-only for students</strong>
                    Only the site admin can upload or delete. That limit is enforced by the server, not by hiding a button.
                  </span>
                </li>
              </ul>
              <a href="/signin" className="land-inline-cta">
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
              {steps.map((step) => (
                <article key={step.n} className="land-step">
                  <span className="land-step-n">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="inside" className="land-section land-latest">
          <div className="land-wrap">
            <div className="land-latest-head">
              <div>
                <p className="land-kicker">What&apos;s in the library</p>
                <h2 className="land-h2">An example of what you will find.</h2>
              </div>
              <p className="land-latest-note">
                Example only. Real class material appears after you sign in — it is never shown to logged-out visitors.
              </p>
            </div>

            <div className="land-latest-list">
              <div className="land-latest-row land-latest-row--example">
                <span className="land-latest-kind">PDF</span>
                <span className="land-latest-body">
                  <strong>Cell Structure — Chapter 4</strong>
                  <span>Biology · Class 10</span>
                </span>
                <span className="land-latest-date">12 Nov 2026</span>
                <span className="land-example-badge">Example</span>
              </div>
            </div>

            <a href="/signin" className="land-inline-cta">
              Sign in to see your class library
              <ArrowRight className="size-4" aria-hidden />
            </a>
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
              <p className="land-kicker">Practice resources</p>
              <h2 className="land-h2">A small toolkit beside the notes.</h2>
              <p className="land-body">
                Everything that is not the notes themselves sits beside them: the class decks, the files attached to your cards,
                and the small set of numbers that tell you what to revise next.
              </p>
              <a href="/signin" className="land-inline-cta">
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
                <p className="land-kicker">Practice</p>
                <h2 className="land-h2">When you want to test yourself.</h2>
              </div>
              <p className="land-quiz-note">
                Flashcards and quizzes are the second half of MyClassroom, not the front door. They sit inside a deck you are
                already reading — nothing to set up, nothing to configure.
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
                through a topic, and each person&apos;s progress is held separately from everyone else&apos;s.
              </p>
              <p className="land-body">
                It is built and run by an individual developer — not by a school, college, coaching centre or board. Class material
                is uploaded only by the site admin, who confirms they have the right to share it; it is not checked, approved or
                endorsed by any institution.
              </p>
              <p className="land-body land-body--muted">
                If you hold rights to something here, use the <a href="/copyright">Copyright page</a> to request removal.
                Questions and privacy requests go through the <a href="/contact">contact page</a>, or by email to{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
              <div className="land-about-tags">
                <span>
                  <Sparkles className="size-3.5" aria-hidden />
                  Independent
                </span>
                <span>
                  <Lock className="size-3.5" aria-hidden />
                  Read-only for students
                </span>
                <span>
                  <UsersRound className="size-3.5" aria-hidden />
                  Server-checked permissions
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
              <p className="land-footer-copy">
                A searchable class notes library, with flashcards and quizzes for the revision that comes after.
              </p>
            </div>
            <nav aria-label="Platform">
              <h2>Platform</h2>
              <a href="#home">Home</a>
              <a href="#library">Class notes</a>
              <a href="#quizzes">Practice</a>
              <a href="#about">About</a>
            </nav>
            <nav aria-label="Support">
              <h2>Support</h2>
              <a href="/contact">Contact</a>
              <a href={`mailto:${CONTACT_EMAIL}`}>Email the operator</a>
              <a href="/signin">Sign in</a>
            </nav>
            <nav aria-label="Legal">
              <h2>Legal</h2>
              {LEGAL_PAGES.filter((page) => page.to !== '/contact').map((page) => (
                <a key={page.to} href={page.to}>
                  {page.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="land-footer-base">
            <p>{DISCLAIMER}</p>
            <p className="land-footer-sign">MyClassroom · class notes, in one place</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* An honest mockup rather than a screenshot: it shows the search field, the
   result rows and the preview pane the library actually offers, using made-up
   classwork names. It is labelled as an illustration in the caption. */
function LibraryMockup() {
  return (
    <svg
      viewBox="0 0 540 420"
      className="land-mock"
      role="img"
      aria-labelledby="land-mock-title land-mock-desc"
    >
      <title id="land-mock-title">Illustration of the MyClassroom library</title>
      <desc id="land-mock-desc">
        A search field, class and subject filters, three example note rows and a document preview pane.
      </desc>
      <defs>
        <linearGradient id="land-mock-page" x1="0" y1="0" x2="0.6" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#f2f8ff" />
        </linearGradient>
        <filter id="land-mock-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#061733" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect x="14" y="12" width="512" height="368" rx="20" fill="url(#land-mock-page)" filter="url(#land-mock-shadow)" stroke="#d7e5f4" />
      <circle cx="38" cy="36" r="4" fill="#c8d9ee" />
      <circle cx="52" cy="36" r="4" fill="#c8d9ee" />
      <circle cx="66" cy="36" r="4" fill="#c8d9ee" />
      <rect x="88" y="31" width="150" height="10" rx="5" fill="#e3eefb" />

      <rect x="34" y="60" width="212" height="34" rx="10" fill="#ffffff" stroke="#cfe0f2" />
      <circle cx="52" cy="77" r="5.5" fill="none" stroke="#6c8aa8" strokeWidth="1.6" />
      <path d="m56 81 4 4" stroke="#6c8aa8" strokeWidth="1.6" strokeLinecap="round" />
      <text x="68" y="81" fill="#6c8aa8" fontSize="11" fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
        Search notes
      </text>

      <rect x="258" y="60" width="66" height="34" rx="10" fill="#dce8ff" />
      <text x="272" y="81" fill="#17419f" fontSize="10.5" fontWeight="600" fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
        Class 10
      </text>
      <rect x="332" y="60" width="58" height="34" rx="10" fill="#e9f2fd" />
      <text x="345" y="81" fill="#47688c" fontSize="10.5" fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
        Biology
      </text>

      <line x1="34" y1="110" x2="332" y2="110" stroke="#e3eefb" />

      <g fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
        <rect x="34" y="124" width="298" height="52" rx="11" fill="#dce8ff" />
        <rect x="46" y="136" width="28" height="28" rx="7" fill="#ffffff" />
        <text x="55" y="155" fill="#17419f" fontSize="8" fontWeight="700">PDF</text>
        <text x="84" y="146" fill="#05162f" fontSize="11.5" fontWeight="600">Cell Structure — Chapter 4</text>
        <text x="84" y="162" fill="#6c8aa8" fontSize="9.5">Biology · Class 10</text>

        <rect x="34" y="184" width="298" height="52" rx="11" fill="#e9f2fd" />
        <rect x="46" y="196" width="28" height="28" rx="7" fill="#ffffff" />
        <text x="55" y="215" fill="#17419f" fontSize="8" fontWeight="700">PDF</text>
        <text x="84" y="206" fill="#05162f" fontSize="11.5" fontWeight="600">Trigonometry Notes</text>
        <text x="84" y="222" fill="#6c8aa8" fontSize="9.5">Mathematics · Class 10</text>

        <rect x="34" y="244" width="298" height="52" rx="11" fill="#e9f2fd" />
        <rect x="46" y="256" width="28" height="28" rx="7" fill="#ffffff" />
        <text x="53" y="275" fill="#17419f" fontSize="7.5" fontWeight="700">PPT</text>
        <text x="84" y="266" fill="#05162f" fontSize="11.5" fontWeight="600">The Cold War</text>
        <text x="84" y="282" fill="#6c8aa8" fontSize="9.5">History · Class 10</text>
      </g>

      <rect x="346" y="124" width="160" height="172" rx="12" fill="#ffffff" stroke="#d7e5f4" />
      <text x="360" y="144" fill="#47688c" fontSize="9.5" fontWeight="600" fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
        Preview
      </text>
      <rect x="360" y="156" width="132" height="112" rx="6" fill="#f7fbff" />
      <rect x="370" y="168" width="74" height="8" rx="4" fill="#c8d9ee" />
      <rect x="370" y="184" width="112" height="5" rx="2.5" fill="#dbe8f6" />
      <rect x="370" y="195" width="104" height="5" rx="2.5" fill="#dbe8f6" />
      <rect x="370" y="206" width="110" height="5" rx="2.5" fill="#dbe8f6" />
      <rect x="370" y="217" width="80" height="5" rx="2.5" fill="#dbe8f6" />
      <rect x="370" y="233" width="56" height="18" rx="6" fill="#dce8ff" />
      <text x="360" y="288" fill="#6c8aa8" fontSize="8.5" fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
        Example document
      </text>

      <rect x="34" y="318" width="472" height="42" rx="12" fill="#0f2f7a" />
      <text x="50" y="344" fill="#ffffff" fontSize="10.5" fontWeight="600" fontFamily="Plus Jakarta Sans Variable, system-ui, sans-serif">
        Search, preview and download — all in one place
      </text>
      <path d="M470 334h12m-4-4 4 4-4 4" stroke="#a9d3f8" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
