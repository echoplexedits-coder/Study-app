import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Copy, KeyRound, Search, ShieldCheck, ShieldOff, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Badge, Button, EmptyState, Input, Skeleton, useToast } from '../components/ui'
import { issueResetLink, setAccountStatus, useAdminUsers, useMe, useResetRequests } from '../lib/api'
import { cx } from '../lib/cx'
import type { AdminUser } from '../../shared/types'

function when(value: number): string {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function whenExact(value: number): string {
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}


function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className="mt-1 font-display text-[26px] font-semibold leading-none tracking-tight text-fg-deep">{value}</p>
    </div>
  )
}

function Avatar({ name }: { name: string | null }) {
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-deep" aria-hidden>
      {initial}
    </span>
  )
}

export function AdminUsers() {
  const me = useMe()
  const client = useQueryClient()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [link, setLink] = useState<{ id: string; url: string; expiresAt: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [clock, setClock] = useState(Date.now())

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(query.trim())
      setPage(0)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  // Re-render the banner while it is open so a link visibly expires at 30 minutes.
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const admin = Boolean(me?.data?.capabilities.canEdit)
  const users = useAdminUsers(search, page)
  const requests = useResetRequests(admin)

  if (me && !admin) {
    return (
      <div className="mx-auto max-w-[640px]">
        <EmptyState icon={<ShieldOff />} title="Administrators only" description="This page is limited to accounts with the admin role. The server refuses these requests for every other account." />
      </div>
    )
  }

  const counts = users.data?.counts
  const rows = users.data?.users ?? []

  async function toggle(user: AdminUser) {
    setBusy(user.sub)
    setError('')
    try {
      await setAccountStatus(user.sub, user.status === 'active' ? 'suspended' : 'active')
      await client.invalidateQueries({ queryKey: ['admin-users'] })
      toast(user.status === 'active' ? 'Account suspended' : 'Account restored')
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function mint(id: string) {
    setBusy(id)
    setError('')
    try {
      const result = await issueResetLink(id)
      setLink({
        id,
        url: `${window.location.origin}${result.path}`,
        expiresAt: Date.now() + Math.max(1, result.expiresInMinutes) * 60_000,
      })
      setCopied(false)
      await client.invalidateQueries({ queryKey: ['reset-requests'] })
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-[920px]">
      <div className="flex items-center gap-2 text-[12.5px] text-faint">
        <Link to="/settings" className="inline-flex items-center gap-1.5 hover:text-fg">
          <ArrowLeft className="size-3.5" aria-hidden /> Settings
        </Link>
      </div>
      <h1 className="mt-2 font-display text-[30px] font-semibold tracking-[-0.02em] text-fg-deep">User management</h1>
      <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-muted">
        Every account in MyClassroom. Passwords and session tokens are never stored in a readable form and are not selectable here.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Accounts" value={counts?.total ?? 0} />
        <Stat label="Students" value={counts?.students ?? 0} />
        <Stat label="Admins" value={counts?.admins ?? 0} />
        <Stat label="Suspended" value={counts?.suspended ?? 0} />
      </div>

      <div className="mt-7">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search username, student ID, name or email"
            className="h-11 pl-9"
            aria-label="Search accounts"
          />
        </div>
      </div>

      {error && <p role="alert" className="mt-4 rounded-control border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-danger">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-card border border-line/70 bg-surface shadow-card">
        {users.isPending ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-control" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users />} title={search ? 'No matching accounts' : 'No accounts yet'} description={search ? 'Try a different username, student ID or email.' : 'Accounts appear here as soon as people register.'} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((user) => (
              <li key={user.sub} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <Avatar name={user.fullName ?? user.username} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="truncate text-[13.5px] font-semibold text-fg">{user.username ? `@${user.username}` : <span className="text-faint">no username yet</span>}</span>
                    {user.role === 'admin' && (
                      <Badge tone="accent">
                        <ShieldCheck className="size-3" aria-hidden /> Admin
                      </Badge>
                    )}
                    {user.status === 'suspended' && <Badge tone="danger">Suspended</Badge>}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {user.fullName ?? 'Unnamed'} · {user.email ?? 'no email'}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
                    <span className="font-mono tracking-tight">{user.studentId ?? '—'}</span>
                    <span>Joined {when(user.createdAt)}</span>
                    <span>{user.hasPassword ? 'Password sign-in' : 'Provider sign-in'}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant={user.status === 'active' ? 'danger' : 'secondary'}
                    loading={busy === user.sub}
                    disabled={user.sub === me?.data?.user.sub}
                    onClick={() => toggle(user)}
                  >
                    {user.status === 'active' ? 'Suspend' : 'Restore'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {users.data && users.data.counts.total > users.data.pageSize && (
        <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted">
          <span>
            Page {page + 1} of {Math.max(1, Math.ceil(users.data.counts.total / users.data.pageSize))}
          </span>
          <span className="flex gap-2">
            <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Previous
            </Button>
            <Button size="sm" disabled={rows.length < users.data.pageSize} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-[14px] font-semibold text-fg">Password reset requests</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-faint">
          Open requests, newest first. Creating a link mints a single-use token that expires in 30 minutes — copy it now, it cannot be shown again.
        </p>

        {link && (() => {
          const expired = clock >= link.expiresAt
          const minutes = Math.max(0, Math.ceil((link.expiresAt - clock) / 60_000))
          return (
            <div className={`mt-3 rounded-card border p-4 ${expired ? 'border-line bg-surface-2' : 'border-accent/30 bg-accent-soft/50'}`}>
              <p className={`text-[12px] font-medium ${expired ? 'text-muted' : 'text-accent-deep'}`}>
                {expired ? 'Reset link expired' : 'One-time reset link'}
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} className="font-mono text-[12px]" />
                <Button
                  variant="primary"
                  disabled={expired}
                  onClick={async () => {
                    if (expired) return
                    try {
                      await navigator.clipboard.writeText(link.url)
                      setCopied(true)
                      toast('Link copied')
                    } catch {
                      toast('Select the link and copy it manually')
                    }
                  }}
                >
                  {expired ? <ShieldOff className="size-4" aria-hidden /> : copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {expired ? 'Expired' : copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="mt-2 text-[11.5px] text-muted">
                {expired
                  ? 'This link is no longer valid. Create a new link for the request below.'
                  : `Expires in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. Send it through a channel you trust; it signs the student out everywhere they are already signed in.`}
              </p>
            </div>
          )
        })()}

        <div className="mt-3 overflow-hidden rounded-card border border-line/70 bg-surface shadow-card">
          {requests.isPending ? (
            <div className="p-4">
              <Skeleton className="h-12 rounded-control" />
            </div>
          ) : (requests.data?.requests.length ?? 0) === 0 ? (
            <p className="p-4 text-[12.5px] text-faint">No open requests.</p>
          ) : (
            <ul className="divide-y divide-line">
              {requests.data?.requests.map((request) => (
                <li key={request.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <KeyRound className="size-4 shrink-0 text-faint" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{request.username ? `@${request.username}` : request.identifier}</p>
                    <p className="text-[11.5px] text-faint">
                      {request.studentId ?? '—'} · requested {whenExact(request.createdAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="primary" loading={busy === request.id} onClick={() => mint(request.id)}>
                    Create link
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

export function AdminUsersLink() {
  return (
    <Link to="/admin/users" className={cx('inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-deep underline-offset-4 hover:underline')}>
      <Users className="size-3.5" aria-hidden /> Open user management
    </Link>
  )
}
