import { useQueryClient } from '@tanstack/react-query'
import { Check, KeyRound, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'

import { Button, Input, useToast } from './ui'
import { UsernameField, useUsernameCheck, usernameReady } from './UsernameField'
import { changePassword, changeUsername, updateProfile, useProfile } from '../lib/api'
import { cx } from '../lib/cx'
import { normalizeUsername, passwordProblem } from '../../shared/identity'
import { AdminUsersLink } from '../pages/AdminUsers'

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-card border border-line/70 bg-surface p-4 shadow-card">
      <p className="text-[13.5px] font-medium text-fg">{title}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

/**
 * The signed-in person's own record. Identity fields (internal id, student id,
 * role) are displayed so they can be quoted to a teacher, and are deliberately
 * not editable — the API ignores any attempt to change them.
 */
export function AccountSettings() {
  const profile = useProfile()
  const client = useQueryClient()
  const toast = useToast()

  const [fullName, setFullName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const check = useUsernameCheck(username, { current: profile.data?.username })
  const nameChanged = Boolean(profile.data?.username) && normalizeUsername(username) !== (profile.data?.username ?? '')

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    if (profile.data?.fullName) setFullName(profile.data.fullName)
  }, [profile.data?.fullName])

  const passwordIssue = password ? passwordProblem(password, { username: profile.data?.username ?? undefined, email: profile.data?.email ?? undefined, name: profile.data?.fullName ?? undefined }) : null
  const mismatch = Boolean(confirm) && password !== confirm

  async function saveName(event: FormEvent) {
    event.preventDefault()
    if (fullName.trim().length < 2) {
      setNameError('Enter your full name.')
      return
    }
    setNameSaving(true)
    setNameError('')
    try {
      await updateProfile({ fullName: fullName.trim() })
      await Promise.all([client.invalidateQueries({ queryKey: ['me'] }), client.invalidateQueries({ queryKey: ['profile'] })])
      toast('Name updated')
    } catch (failure) {
      setNameError((failure as Error).message)
    } finally {
      setNameSaving(false)
    }
  }

  async function saveUsername(event: FormEvent) {
    event.preventDefault()
    if (!usernameReady(check, username) || !nameChanged) return
    setUsernameSaving(true)
    setUsernameError('')
    try {
      await changeUsername(normalizeUsername(username))
      await Promise.all([client.invalidateQueries({ queryKey: ['me'] }), client.invalidateQueries({ queryKey: ['profile'] })])
      setUsername('')
      toast('Username updated')
    } catch (failure) {
      setUsernameError((failure as Error).message)
    } finally {
      setUsernameSaving(false)
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    if (passwordIssue || mismatch || !password) return
    setPasswordSaving(true)
    setPasswordError('')
    try {
      await changePassword({ currentPassword: currentPassword || undefined, password, confirmPassword: confirm })
      setPassword('')
      setConfirm('')
      setCurrentPassword('')
      await client.invalidateQueries({ queryKey: ['profile'] })
      toast('Password updated')
    } catch (failure) {
      setPasswordError((failure as Error).message)
    } finally {
      setPasswordSaving(false)
    }
  }

  const data = profile.data

  return (
    <div>
      <div className="mt-3 overflow-hidden rounded-card border border-line/70 bg-surface shadow-card">
        <dl className="divide-y divide-line">
          {[
            ['Username', data?.username ? `@${data.username}` : 'Not chosen yet'],
            ['Student ID', data?.studentId ?? '—'],
            ['Email', data?.email ?? '—'],
            ['Role', data?.role === 'admin' ? 'Administrator — can edit the library' : 'Student — read-only library'],
            ['Account status', data?.status === 'suspended' ? 'Suspended' : 'Active'],
            ['Internal account ID', data?.sub ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
              <dt className="text-[12px] text-faint">{label}</dt>
              <dd className={cx('truncate text-right text-[12.5px] font-medium text-fg', label === 'Internal account ID' && 'font-mono text-[11px] tracking-tight text-muted')}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Card title="Display name" description="Your name as it appears on your own profile.">
        <form onSubmit={saveName} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" className="h-10 sm:flex-1" aria-label="Full name" />
          <Button type="submit" variant="primary" loading={nameSaving} disabled={fullName.trim().length < 2}>
            <Check className="size-4" aria-hidden /> Save
          </Button>
        </form>
        {nameError && <p className="mt-2 text-[12px] font-medium text-danger">{nameError}</p>}
      </Card>

      <Card title="Username" description="Unique across MyClassroom and checked live. It can change once every 30 days; your student ID never changes.">
        <form onSubmit={saveUsername} className="space-y-3">
          <UsernameField value={username} onChange={setUsername} check={check} current={data?.username} />
          {usernameError && <p className="text-[12px] font-medium text-danger">{usernameError}</p>}
          <Button type="submit" variant="primary" loading={usernameSaving} disabled={!usernameReady(check, username) || !nameChanged}>
            <UserRound className="size-4" aria-hidden /> Change username
          </Button>
        </form>
      </Card>

      <Card
        title={data?.hasPassword ? 'Password' : 'Set a password'}
        description={
          data?.hasPassword
            ? 'Changing it signs out every other device and keeps this one signed in.'
            : 'You signed in with a provider. Adding a password lets you sign in with your username too.'
        }
      >
        <form onSubmit={savePassword} className="space-y-2.5">
          {data?.hasPassword && (
            <Input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" autoComplete="current-password" className="h-10" aria-label="Current password" />
          )}
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" autoComplete="new-password" className="h-10" aria-label="New password" />
          <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="Confirm new password" autoComplete="new-password" className="h-10" aria-label="Confirm new password" />
          {passwordIssue && <p className="text-[12px] font-medium text-danger">{passwordIssue}</p>}
          {mismatch && <p className="text-[12px] font-medium text-danger">The two passwords do not match.</p>}
          {passwordError && <p className="text-[12px] font-medium text-danger">{passwordError}</p>}
          <Button type="submit" variant="primary" loading={passwordSaving} disabled={!password || Boolean(passwordIssue) || mismatch || (Boolean(data?.hasPassword) && !currentPassword)}>
            <KeyRound className="size-4" aria-hidden /> {data?.hasPassword ? 'Change password' : 'Set password'}
          </Button>
        </form>
      </Card>

      {data?.role === 'admin' && (
        <div className="mt-4">
          <AdminUsersLink />
        </div>
      )}
    </div>
  )
}
