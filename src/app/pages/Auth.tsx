import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, User } from 'lucide-react'
import { useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { LegalFooter } from '../components/LegalFooter'
import { Brand } from '../components/SiteNav'
import { UsernameField, useUsernameCheck, usernameReady } from '../components/UsernameField'
import { loginWithPassword, registerAccount, requestPasswordReset, resetPassword, useAuthStatus } from '../lib/api'
import { cx } from '../lib/cx'
import { normalizeUsername, passwordProblem, passwordScore, PASSWORD_STRENGTH_LABELS } from '../../shared/identity'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Only same-site paths survive a round trip through the query string. */
function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  return value
}

const STRENGTH_TONE = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success']

function AuthLayout({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(120%_90%_at_12%_-10%,#ffffff_0%,#eff7ff_36%,#dcecfc_68%,#cde2f8_100%)]">
      <header className="mx-auto flex h-20 w-full max-w-[1120px] items-center px-5 sm:px-8">
        <Link to="/" aria-label="MyClassroom home" className="rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <Brand />
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1120px] flex-1 items-center gap-10 px-5 pb-14 pt-2 sm:px-8 lg:grid-cols-[1fr_minmax(0,468px)] lg:gap-16">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="hidden max-w-[44ch] lg:block"
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.3em] text-accent/70">MyClassroom</p>
          <h1 className="mt-4 font-display text-[46px] font-semibold leading-[1.02] tracking-[-0.025em] text-fg-deep">{title}</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted">{lead}</p>
          <ul className="mt-9 space-y-4">
            {[
              ['One library, one account', 'Notes, decks and progress follow you between devices.'],
              ['A username you own', 'Unique across the class, kept permanently, changeable later.'],
              ['Read-only by default', 'Students read and download; only the admin uploads.'],
            ].map(([heading, body]) => (
              <li key={heading} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent/70" aria-hidden />
                <span>
                  <span className="block text-[13.5px] font-semibold text-fg-deep">{heading}</span>
                  <span className="block text-[12.5px] leading-relaxed text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-panel border border-line/80 bg-surface/92 p-6 shadow-elevated backdrop-blur-xl sm:p-8"
        >
          <h2 className="font-display text-[25px] font-semibold leading-tight tracking-[-0.02em] text-fg-deep lg:hidden">{title}</h2>
          {children}
        </motion.section>
      </main>

      <LegalFooter />
    </div>
  )
}

function TextField({
  label,
  icon,
  trailing,
  hint,
  error,
  inputClassName,
  ...input
}: { label: string; icon?: ReactNode; trailing?: ReactNode; hint?: string; error?: string; inputClassName?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[12.5px] font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint [&_svg]:size-4">{icon}</span>}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cx(
            'h-11 w-full rounded-control border bg-surface py-0 text-[14px] text-fg placeholder:text-faint transition-[border-color,box-shadow] focus:outline-none focus:ring-[3px] disabled:opacity-60',
            icon ? 'pl-10' : 'pl-3',
            trailing ? 'pr-11' : 'pr-3',
            error ? 'border-danger/50 focus:border-danger focus:ring-danger/12' : 'border-line-strong focus:border-accent focus:ring-accent/15',
            inputClassName,
          )}
          {...input}
        />
        {trailing && <span className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-[11.5px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11.5px] text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

function PasswordField({ label, name, value, onChange, error, hint, autoComplete }: { label: string; name: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      label={label}
      name={name}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      placeholder="••••••••"
      icon={<Lock />}
      error={error}
      hint={hint}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="grid size-9 place-items-center rounded-[10px] text-faint transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      }
    />
  )
}

function Strength({ password }: { password: string }) {
  if (!password) return null
  const score = passwordScore(password)
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1 flex-1 rounded-full transition-colors duration-200', i < score ? STRENGTH_TONE[score] : 'bg-raised')} />
        ))}
      </div>
      <p className="text-[11px] text-faint">{PASSWORD_STRENGTH_LABELS[score]}</p>
    </div>
  )
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="rounded-control border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger"
    >
      {children}
    </motion.p>
  )
}

function SubmitButton({ children, pending, disabled }: { children: ReactNode; pending: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent px-5 text-[14px] font-semibold text-white shadow-[0_14px_26px_-18px_rgb(23_65_159/0.95)] transition-[background-color,transform] hover:bg-accent-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : children}
    </button>
  )
}

function GoogleButton({ returnTo }: { returnTo: string }) {
  return (
    <a
      href={`/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`}
      className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-control border border-line-strong bg-surface px-4 text-[14px] font-medium text-fg shadow-[0_1px_1px_rgb(20_20_24/0.04)] transition-colors hover:bg-surface-2"
    >
      <span className="grid size-5 place-items-center rounded-[6px] bg-white text-[12px] font-bold text-[#1a73e8] shadow-[0_0_0_1px_rgb(20_20_24/0.06)]">G</span>
      Continue with Google
      <ArrowRight className="size-4 text-faint" aria-hidden />
    </a>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

// ---------------------------------------------------------------------------

export function SignInPage() {
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))
  const notice = params.get('notice')
  const status = useAuthStatus()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await loginWithPassword({ identifier, password })
      window.location.assign(returnTo)
    } catch (failure) {
      setError((failure as Error).message)
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Welcome back." lead="Sign in with your username and password, or with Google. Either way you land in the same library, with the same progress.">
      <div className="space-y-5">
        <div className="hidden lg:block">
          <h2 className="font-display text-[25px] font-semibold tracking-[-0.02em] text-fg-deep">Sign in</h2>
          <p className="mt-1 text-[12.5px] text-muted">Use the account you registered with.</p>
        </div>

        {notice === 'password_account' && (
          <p className="rounded-control border border-line-strong bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted">
            That email already belongs to an account with a password. Sign in with your username and password instead.
          </p>
        )}

        {status.data?.google && (
          <>
            <GoogleButton returnTo={returnTo} />
            <Divider label="or your username" />
          </>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField
            label="Username or email"
            name="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yash123"
            icon={<User />}
            required
          />
          <PasswordField label="Password" name="password" value={password} onChange={setPassword} autoComplete="current-password" />
          {error && <Alert>{error}</Alert>}
          <SubmitButton pending={pending} disabled={!identifier.trim() || !password}>
            Sign in
            <ArrowRight className="size-4" aria-hidden />
          </SubmitButton>
        </form>

        <div className="flex items-center justify-between gap-3 text-[12.5px]">
          <Link to="/signup" className="font-medium text-accent-deep underline-offset-4 hover:underline">
            Create an account
          </Link>
          <Link to="/forgot-password" className="text-muted underline-offset-4 hover:text-fg hover:underline">
            Forgot password?
          </Link>
        </div>

        {status.data?.mode === 'freebuff' && (
          <p className="border-t border-line pt-4 text-[11.5px] leading-relaxed text-faint">
            Site operator?{' '}
            <a href={`/auth/freebuff/signin?returnTo=${encodeURIComponent(returnTo)}`} className="font-medium text-muted underline underline-offset-2 hover:text-fg">
              Sign in with Freebuff
            </a>
          </p>
        )}
      </div>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------

export function SignUpPage() {
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))
  const status = useAuthStatus()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const check = useUsernameCheck(username)
  const emailValid = EMAIL.test(email.trim())
  const passwordIssue = password ? passwordProblem(password, { username: normalizeUsername(username), email, name: fullName }) : null
  const mismatch = Boolean(confirm) && password !== confirm
  const ready = fullName.trim().length >= 2 && usernameReady(check, username) && emailValid && !passwordIssue && password.length > 0 && confirm === password

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!ready) return
    setError('')
    setPending(true)
    try {
      await registerAccount({ fullName: fullName.trim(), username: normalizeUsername(username), email: email.trim().toLowerCase(), password, confirmPassword: confirm })
      window.location.assign(returnTo)
    } catch (failure) {
      setError((failure as Error).message)
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Create your account." lead="One username, one library. Your student ID is generated once and stays with you for as long as the account exists.">
      <div className="space-y-5">
        <div className="hidden lg:block">
          <h2 className="font-display text-[25px] font-semibold tracking-[-0.02em] text-fg-deep">Create account</h2>
          <p className="mt-1 text-[12.5px] text-muted">It takes a minute. The username check is live.</p>
        </div>

        {status.data?.google && (
          <>
            <GoogleButton returnTo={returnTo} />
            <Divider label="or register with a password" />
          </>
        )}

        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField label="Full name" name="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" placeholder="Yash Sharma" icon={<User />} required />

          <UsernameField value={username} onChange={setUsername} check={check} autoFocus={false} />

          <TextField
            label="Email address"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder="you@school.example"
            icon={<Mail />}
            error={touched && email && !emailValid ? 'Enter a valid email address.' : undefined}
            hint="Used for password recovery. Never shown to other students."
            required
          />

          <div>
            <PasswordField label="Password" name="password" value={password} onChange={setPassword} autoComplete="new-password" error={touched ? (passwordIssue ?? undefined) : undefined} />
            <Strength password={password} />
          </div>

          <PasswordField
            label="Confirm password"
            name="confirmPassword"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            error={mismatch ? 'The two passwords do not match.' : undefined}
          />

          {error && <Alert>{error}</Alert>}

          <SubmitButton pending={pending} disabled={!ready}>
            {pending ? 'Creating account…' : 'Create account'}
            {!pending && <ArrowRight className="size-4" aria-hidden />}
          </SubmitButton>

          <p className="text-[11px] leading-relaxed text-faint">
            By creating an account you agree to the{' '}
            <Link to="/terms" className="underline underline-offset-2 hover:text-muted">
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-muted">
              Privacy Policy
            </Link>
            . You will confirm them on the next screen.
          </p>
        </form>

        <p className="text-[12.5px] text-muted">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-accent-deep underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------

export function ForgotPasswordPage() {
  const status = useAuthStatus()
  const [identifier, setIdentifier] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      await requestPasswordReset(identifier.trim())
      setSent(true)
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Reset your password." lead="Reset links are sent by the site admin. We never say whether an account exists.">
      <div className="space-y-5">
        {sent ? (
          <div className="space-y-4">
            <div className="grid size-11 place-items-center rounded-card bg-success-soft text-success">
              <KeyRound className="size-5" aria-hidden />
            </div>
            <h2 className="font-display text-[24px] font-semibold tracking-[-0.02em] text-fg-deep">Request received</h2>
            <p className="text-[13px] leading-relaxed text-muted">
              {status.data?.mail
                ? 'If that account exists, an email with a reset link is on its way. The link works once and expires in 30 minutes.'
                : 'If that account exists, your request is waiting for the site admin. Ask them for a one-time link — it works once and expires in 30 minutes.'}
            </p>
            <Link to="/signin" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-deep underline-offset-4 hover:underline">
              <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <TextField
              label="Username or email"
              name="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="yash123"
              icon={<User />}
              required
            />
            {error && <Alert>{error}</Alert>}
            <p className="rounded-control border border-line-strong bg-surface-2 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
              Reset links are sent by the site admin. Email delivery is not enabled; your request waits for the admin to send you a one-time link.
            </p>
            <SubmitButton pending={pending} disabled={!identifier.trim()}>
              Send reset link
              <ArrowRight className="size-4" aria-hidden />
            </SubmitButton>
            <Link to="/signin" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-fg">
              <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
            </Link>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}

// ---------------------------------------------------------------------------

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const issue = password ? passwordProblem(password) : null
  const mismatch = Boolean(confirm) && password !== confirm

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (issue || mismatch || !password) return
    setError('')
    setPending(true)
    try {
      await resetPassword({ token, password, confirmPassword: confirm })
      setDone(true)
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password." lead="A reset signs every device out, then you sign in again with the new password.">
      <div className="space-y-5">
        {!token ? (
          <div className="space-y-3">
            <h2 className="font-display text-[24px] font-semibold text-fg-deep">This link is incomplete</h2>
            <p className="text-[13px] leading-relaxed text-muted">The reset token is missing. Ask for a new link from the sign-in page.</p>
            <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-deep underline-offset-4 hover:underline">
              Request a reset link
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="grid size-11 place-items-center rounded-card bg-success-soft text-success">
              <CheckCircle2 className="size-5" aria-hidden />
            </div>
            <h2 className="font-display text-[24px] font-semibold text-fg-deep">Password updated</h2>
            <p className="text-[13px] leading-relaxed text-muted">Sign in with your username and the new password.</p>
            <Link to="/signin" className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-accent px-5 text-[14px] font-semibold text-white hover:bg-accent-deep">
              Go to sign in <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <PasswordField label="New password" name="password" value={password} onChange={setPassword} autoComplete="new-password" error={touched ? (issue ?? undefined) : undefined} />
              <Strength password={password} />
            </div>
            <PasswordField label="Confirm new password" name="confirmPassword" value={confirm} onChange={setConfirm} autoComplete="new-password" error={mismatch ? 'The two passwords do not match.' : undefined} />
            {error && <Alert>{error}</Alert>}
            <SubmitButton pending={pending} disabled={!password || Boolean(issue) || mismatch}>
              Update password
              <ArrowRight className="size-4" aria-hidden />
            </SubmitButton>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}
