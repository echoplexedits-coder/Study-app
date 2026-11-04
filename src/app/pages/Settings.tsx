import { useEffect, useState } from 'react'

import { LegalSafety } from '../components/LegalSafety'
import { Avatar, Badge, Button, ConfirmDialog, Input, useToast } from '../components/ui'
import { api, useApiMutation, useMe, useStorage } from '../lib/api'
import { UploadDashboard } from './UploadDashboard'

interface RoleRow {
  email: string
  role: 'admin' | 'student'
  created_at: number
}


function bytes(value: number): string {
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`
}

export function Settings() {
  const { data: me } = useMe()
  const { data: storage } = useStorage()
  const toast = useToast()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'student'>('student')
  const [savingRole, setSavingRole] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addError, setAddError] = useState('')
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null)
  // Storage is included so the Storage card reflects a clear/reset immediately
  // instead of showing the old byte count until the next page load.
  const keys = ['me', 'decks', 'deck', 'stats', 'storage']
  const reset = useApiMutation(() => api('/account/reset', { method: 'POST' }), keys, {
    onSuccess: () => {
      setConfirm(null)
      toast('Sample decks restored')
    },
  })
  const clear = useApiMutation(() => api('/account/data', { method: 'DELETE' }), keys, {
    onSuccess: () => {
      setConfirm(null)
      toast('Library cleared')
    },
  })
  // The list has to load on mount; before this it stayed empty until a role
  // was added or removed, so an admin with roles saw "No roles yet".
  useEffect(() => {
    if (!me?.capabilities.canEdit) return
    let active = true
    api<{ roles: RoleRow[] }>('/admin/roles')
      .then((body) => active && setRoles(body.roles))
      .catch(() => active && setRoles([]))
    return () => {
      active = false
    }
  }, [me?.capabilities.canEdit])

  if (!me) return null

  const loadRoles = async () => {
    try {
      setRoles(await api<{ roles: RoleRow[] }>('/admin/roles').then((body) => body.roles))
    } catch {
      setRoles([])
    }
  }

  const saveRole = async () => {
    if (!newEmail.trim()) return
    setSavingRole(true)
    setAddError('')
    try {
      await api('/admin/roles', { method: 'POST', json: { email: newEmail, role: newRole } })
      setNewEmail('')
      setAddError('')
      toast('Role updated')
      loadRoles()
    } catch (error) {
      setAddError((error as { message?: string }).message ?? 'Could not save role.')
    } finally {
      setSavingRole(false)
    }
  }

  const removeRole = async (email: string) => {
    setDeleting(true)
    try {
      await api(`/admin/roles/${encodeURIComponent(email)}`, { method: 'DELETE' })
      toast('Role removed')
      loadRoles()
    } catch {
      toast('Could not remove role.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="text-[26px] font-bold tracking-[-0.02em]">Settings</h1>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Account</h2>
        <div className="mt-3 flex items-center gap-4 rounded-card bg-surface p-4 shadow-card">
          <Avatar name={me.user.name ?? me.user.email ?? 'You'} hue={218} src={me.user.picture} size={48} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{me.user.name ?? 'Signed in'}</p>
            {me.user.email && <p className="truncate text-[13px] text-muted">{me.user.email}</p>}
            <p className="mt-1.5">
              <Badge tone={me.capabilities.role === 'admin' ? 'success' : 'neutral'} dot>
                {me.capabilities.role === 'admin' ? 'Admin — can edit the library' : 'Student — read-only library'}
              </Badge>
            </p>
          </div>
          {me.capabilities.auth !== 'development' ? (
            <form method="post" action={me.capabilities.auth === 'google' ? '/auth/google/signout' : '/auth/freebuff/signout'}>
              <input type="hidden" name="returnTo" value="/" />
              <Button type="submit">Sign out</Button>
            </form>
          ) : (
            <Badge tone="warning">Development user</Badge>
          )}
        </div>
        {me.capabilities.auth === 'development' && <p className="mt-2 text-[12.5px] text-faint">Sign in with Freebuff is not configured yet. Run the app with FREEBUFF_CLIENT_ID set to use real accounts.</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Connections</h2>
        <ul className="mt-3 divide-y divide-line rounded-card bg-surface shadow-card">
          {[
            ['Database', me.capabilities.database, 'D1 via the DB binding'],
            ['Card attachments', me.capabilities.files, 'R2 via the FILES binding'],
            ['Sign in with Freebuff', me.capabilities.auth === 'freebuff', 'FREEBUFF_CLIENT_ID'],
            ['Sign in with Google', me.capabilities.google, 'GOOGLE_CLIENT_ID'],
          ].map(([label, ok, detail]) => (
            <li key={label as string} className="flex h-13 items-center gap-3 px-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{label}</span>
                <span className="block truncate text-[12px] text-faint">{detail}</span>
              </span>
              <Badge tone={ok ? 'success' : 'neutral'} dot>
                {ok ? 'Connected' : 'Not connected'}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Storage</h2>
        <div className="mt-3 flex items-center gap-3 rounded-card bg-surface p-4 shadow-card">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">Attachments</span>
            <span className="block text-[12.5px] text-muted">
              {storage
                ? `${bytes(storage.used)} across ${storage.files} ${storage.files === 1 ? 'file' : 'files'}. Images and documents up to ${bytes(storage.maxFileSize)} each.`
                : 'Images and documents attached to your cards.'}
            </span>
          </span>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Library roles</h2>
        {me.capabilities.canEdit ? (
          <>
            <p className="mt-1 text-[12.5px] text-faint">
              This is the list of emails that can add, change or remove library content. Only account emails that match a row here get admin access, and a mismatching email silently lands as a student, which is why the upload button can disappear even for the site owner.
            </p>
            <div className="mt-3 divide-y divide-line rounded-card bg-surface shadow-card">
              <div className="flex items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">Add a role</span>
                  <span className="block text-[12.5px] text-muted">Add {newEmail.trim().toLowerCase() || '—'} as {newRole}.</span>
                </span>
              </div>
              <div className="flex items-center gap-3 p-4">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  onKeyDown={(e) => e.key === 'Enter' && saveRole()}
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'admin' | 'student')}
                  className="rounded-control border border-line-strong bg-surface px-3 text-[13.5px] text-fg focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
                >
                  <option value="student">Student</option>
                  <option value="admin">Admin</option>
                </select>
                <Button
                  type="button"
                  variant="primary"
                  loading={savingRole}
                  disabled={!newEmail.trim()}
                  onClick={saveRole}
                >
                  Save role
                </Button>
              </div>
              {addError && <p className="px-4 pb-4 text-[13px] text-danger">{addError}</p>}
              {roles.length === 0 && <p className="px-4 pb-4 text-[13px] text-faint">No roles yet. Add one above.</p>}
              {roles.map((row) => (
                <div key={row.email} className="flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{row.email}</span>
                    <span className="block text-[12.5px] text-muted">
                      {(() => { const d = new Date(row.created_at); return d.toISOString().slice(0, 10) })()} — {row.role === 'admin' ? 'Admin' : 'Student'}
                    </span>
                  </span>
                  {me.capabilities.canEdit && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      loading={deleting}
                      onClick={() => removeRole(row.email)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-1 text-[12.5px] text-faint">Read-only — only the site admin can change who can edit the library.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Classwork uploads</h2>
        {me.capabilities.canEdit ? (
          <UploadDashboard />
        ) : (
          <p className="mt-1 text-[12.5px] text-faint">Read-only — only the site admin can upload classwork.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-[14px] font-semibold">Data</h2>
        <div className="mt-3 divide-y divide-line rounded-card bg-surface shadow-card">
          {me.capabilities.canEdit && (
            <div className="flex items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">Restore sample decks</span>
                <span className="block text-[12.5px] text-muted">Replaces your library with the three starter decks.</span>
              </span>
              <Button onClick={() => setConfirm('reset')}>Restore</Button>
            </div>
          )}
          <div className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium">Clear library</span>
              <span className="block text-[12.5px] text-muted">
                {me.capabilities.canEdit ? 'Deletes every deck, card and session. This cannot be undone.' : 'Deletes your study progress and session history. This cannot be undone.'}
              </span>
            </span>
            <Button variant="danger" onClick={() => setConfirm('clear')}>
              Clear
            </Button>
          </div>
        </div>
      </section>

      <LegalSafety me={me} />

      <ConfirmDialog open={confirm === 'reset'} onClose={() => setConfirm(null)} onConfirm={() => reset.mutate(undefined)} loading={reset.isPending} title="Restore sample decks?" description="Your current decks and progress are replaced." confirmLabel="Restore" />
      <ConfirmDialog open={confirm === 'clear'} onClose={() => setConfirm(null)} onConfirm={() => clear.mutate(undefined)} loading={clear.isPending} title="Clear your library?" description="Every deck, card, image and session is deleted." confirmLabel="Clear everything" />
    </div>
  )
}
