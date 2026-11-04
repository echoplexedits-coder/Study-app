import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'

import { DISCLAIMER, LEGAL_PAGES, REPORT_REASONS, TARGET_TYPES } from '../../shared/legal'
import type { Me } from '../../shared/types'
import { api, deleteAccount, downloadMyData, fileReport, requestDeletion, useConsent, useDecks } from '../lib/api'
import { Badge, Button, Dialog, Input, Textarea, useToast } from './ui'

interface ReportRow {
  id: string
  reporter_email: string | null
  kind: string
  target_type: string
  target_id: string | null
  reason: string
  details: string
  status: string
  created_at: number
}
interface MessageRow {
  id: string
  name: string | null
  email: string
  topic: string
  message: string
  status: string
  created_at: number
}
interface RequestRow {
  id: string
  email: string | null
  kind: string
  details: string | null
  status: string
  created_at: number
}

const when = (ts: number | null) => (ts ? new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

/**
 * Legal & safety in Settings. Every control here talks to a real endpoint:
 * consent comes from `/legal/status`, the download is the person's own export,
 * reports and deletion requests are stored, and deleting the account removes
 * the content, progress, sessions and consent rows on the server.
 */
export function LegalSafety({ me }: { me: Me }) {
  const toast = useToast()
  const { data: consent } = useConsent()
  const [requestOpen, setRequestOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    setDownloading(true)
    try {
      const name = await downloadMyData()
      toast(`Downloaded ${name}`)
    } catch (error) {
      toast((error as Error).message, 'danger')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-[14px] font-semibold">Legal &amp; safety</h2>
      <div className="mt-3 divide-y divide-line rounded-card bg-surface shadow-card">
        <div className="p-4">
          <p className="text-[13.5px] font-medium">Policies</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Terms, privacy, acceptable use, copyright and contact.</p>
          <nav aria-label="Policies" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_PAGES.map((page) => (
              <Link key={page.to} to={page.to} className="text-[12.5px] font-medium text-accent hover:text-accent-deep">
                {page.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">Your acceptance</span>
            <span className="block text-[12.5px] text-muted">
              {consent?.accepted
                ? `Policy version ${consent.version} accepted on ${when(consent.acceptedAt)}.`
                : 'The current policies have not been accepted yet; content changes stay blocked until they are.'}
            </span>
          </span>
          <Badge tone={consent?.accepted ? 'success' : 'warning'} dot>
            {consent?.accepted ? 'Accepted' : 'Pending'}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">Download my data</span>
            <span className="block text-[12.5px] text-muted">
              A JSON copy of your account, decks, cards, progress, sessions, consent records and requests.
            </span>
          </span>
          <Button onClick={download} loading={downloading}>
            Download
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">Report content or a copyright issue</span>
            <span className="block text-[12.5px] text-muted">Goes to the site admin's moderation inbox. False reports breach the acceptable use policy.</span>
          </span>
          <Button onClick={() => setReportOpen(true)}>Report</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">Ask for deletion without signing in later</span>
            <span className="block text-[12.5px] text-muted">Leaves a request for the admin if you cannot use the self-serve deletion below.</span>
          </span>
          <Button onClick={() => setRequestOpen(true)}>Request</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium">Delete my account</span>
            <span className="block text-[12.5px] text-muted">
              Deletes your decks, cards, attachments, progress, sessions, consent records, role and account row. This cannot be undone.
            </span>
          </span>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-faint">{DISCLAIMER}</p>

      {me.capabilities.canEdit && <AdminSafetyInbox />}

      <RequestDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} auth={me.capabilities.auth} />
    </section>
  )
}

function RequestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [kind, setKind] = useState<'delete_data' | 'delete_account'>('delete_data')
  const [details, setDetails] = useState('')
  const request = useMutation({
    mutationFn: () => requestDeletion(kind, details),
    onSuccess: (result) => {
      onClose()
      setDetails('')
      toast(result.duplicate ? 'A request is already open' : 'Request sent to the admin')
    },
    onError: (error) => toast((error as Error).message, 'danger'),
  })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send a deletion request"
      description="Use this if you want the admin to delete data for you. Signed-in users can delete immediately in Settings instead."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => request.mutate()} loading={request.isPending}>
            Send request
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">What should be deleted?</span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'delete_data' | 'delete_account')}
          className="h-9 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px]"
        >
          <option value="delete_data">My content and study data</option>
          <option value="delete_account">My whole account</option>
        </select>
      </label>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">Details (optional)</span>
        <Textarea value={details} rows={4} onChange={(e) => setDetails(e.target.value)} placeholder="Anything the admin needs to identify the account or the data." />
      </label>
    </Dialog>
  )
}

function ReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const { data: decks } = useDecks()
  const [targetType, setTargetType] = useState<'deck' | 'card' | 'classwork' | 'other'>('deck')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState<string>('copyright')
  const [details, setDetails] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [accuracy, setAccuracy] = useState(false)
  const [rightsHolder, setRightsHolder] = useState(false)
  const copyright = reason === 'copyright'
  const report = useMutation({
    mutationFn: () =>
      fileReport({
        kind: copyright ? 'copyright' : 'content',
        targetType,
        targetId: targetId.trim() || undefined,
        reason,
        details,
        goodFaith,
        accuracyConfirmed: accuracy,
        rightsHolder: copyright ? rightsHolder : undefined,
      }),
    onSuccess: () => {
      onClose()
      setDetails('')
      setGoodFaith(false)
      setAccuracy(false)
      setRightsHolder(false)
      toast('Report sent to the admin')
    },
    onError: (error) => toast((error as Error).message, 'danger'),
  })
  const ready = details.trim().length >= 10 && goodFaith && accuracy && (!copyright || rightsHolder) && targetId.trim().length > 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Report content"
      description="Reports are stored for the admin to review. A copyright report needs the extra confirmation below."
      width={520}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => report.mutate()} loading={report.isPending} disabled={!ready}>
            Send report
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Where is the problem?</span>
          <select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as typeof targetType)
              setTargetId('')
            }}
            className="h-9 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px]"
          >
            {TARGET_TYPES.map((target) => (
              <option key={target.value} value={target.value}>
                {target.label}
              </option>
            ))}
          </select>
        </label>

        {targetType === 'deck' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">Deck</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-9 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px]"
            >
              <option value="">Choose a deck…</option>
              {decks?.items.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </select>
          </label>
        )}

        {targetType !== 'deck' && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium">{targetType === 'card' ? 'Card link or card id' : targetType === 'classwork' ? 'Classwork file name' : 'What is it?'}</span>
            <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder={targetType === 'other' ? 'Describe it or paste a link' : 'Paste the link or identifier'} />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded-control border border-line-strong bg-surface px-3 text-[13.5px]">
            {REPORT_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">What is wrong?</span>
          <Textarea
            value={details}
            rows={4}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Name the content, explain the problem, and add anything the admin needs to check it."
          />
        </label>

        <div className="flex flex-col gap-2.5">
          <Check checked={goodFaith} onChange={setGoodFaith}>
            I have a good-faith belief this content breaks the rules or infringes rights.
          </Check>
          <Check checked={accuracy} onChange={setAccuracy}>
            The information in this report is accurate to the best of my knowledge.
          </Check>
          {copyright && (
            <Check checked={rightsHolder} onChange={setRightsHolder}>
              I own the work, or I am authorised to act for the owner, and I can provide the permission or licence on request.
            </Check>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]" />
      <span className="text-[13px] leading-relaxed text-muted">{children}</span>
    </label>
  )
}

function DeleteAccountDialog({ open, onClose, auth }: { open: boolean; onClose: () => void; auth: Me['capabilities']['auth'] }) {
  const toast = useToast()
  const [text, setText] = useState('')
  const remove = useMutation({
    mutationFn: () => deleteAccount(text),
    onSuccess: (result) => {
      toast(`Deleted ${result.deleted.decks} decks and ${result.deleted.sessions} sessions`)
      signOut(auth)
    },
    onError: (error) => toast((error as Error).message, 'danger'),
  })
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete your account?"
      description="This removes your content, attachments, progress, sessions, consent records, role and account row. It cannot be undone."
      width={460}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={text !== 'DELETE'} loading={remove.isPending} onClick={() => remove.mutate()}>
            Delete everything
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </span>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" autoComplete="off" />
      </label>
      <p className="mt-3 text-[12px] leading-relaxed text-faint">
        You will be signed out. A JSON copy can be downloaded before deleting, and the deletion request option is for cases where you cannot sign in later.
      </p>
    </Dialog>
  )
}

/** Signs out through the same endpoint the Settings button uses. */
function signOut(auth: Me['capabilities']['auth']) {
  if (auth === 'development') {
    window.location.reload()
    return
  }
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = auth === 'google' ? '/auth/google/signout' : '/auth/freebuff/signout'
  const returnTo = document.createElement('input')
  returnTo.type = 'hidden'
  returnTo.name = 'returnTo'
  returnTo.value = '/'
  form.appendChild(returnTo)
  document.body.appendChild(form)
  form.submit()
}

function AdminSafetyInbox() {
  const client = useQueryClient()
  const toast = useToast()
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: () => api<{ reports: ReportRow[] }>('/admin/reports') })
  const messages = useQuery({ queryKey: ['admin-messages'], queryFn: () => api<{ messages: MessageRow[] }>('/admin/messages') })
  const requests = useQuery({ queryKey: ['admin-requests'], queryFn: () => api<{ requests: RequestRow[] }>('/admin/requests') })
  const resolveReport = useMutation({
    mutationFn: (id: string) => api(`/admin/reports/${id}`, { method: 'PATCH', json: { status: 'resolved' } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin-reports'] })
      toast('Report resolved')
    },
    onError: (error) => toast((error as Error).message, 'danger'),
  })
  const readMessage = useMutation({
    mutationFn: (id: string) => api(`/admin/messages/${id}`, { method: 'PATCH', json: { status: 'read' } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-messages'] }),
  })
  const resolveRequest = useMutation({
    mutationFn: (id: string) => api(`/admin/requests/${id}`, { method: 'PATCH', json: { status: 'resolved' } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin-requests'] }),
  })

  return (
    <div className="mt-8">
      <h2 className="text-[14px] font-semibold">Safety review</h2>
      <p className="mt-1 text-[12.5px] text-faint">Admin only. Reports, contact messages and deletion requests, newest first.</p>

      <h3 className="mt-4 text-[13px] font-semibold text-muted">Content reports</h3>
      <div className="mt-2 flex flex-col gap-2">
        {reports.data?.reports.length === 0 && <p className="text-[12.5px] text-faint">No reports.</p>}
        {reports.data?.reports.slice(0, 8).map((row) => (
          <div key={row.id} className="rounded-card border border-line bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={row.status === 'open' ? 'warning' : 'success'}>{row.status}</Badge>
              <span className="text-[13px] font-medium">{row.reason}</span>
              <span className="text-[12px] text-faint">
                {row.kind} · {row.target_type} · {when(row.created_at)}
              </span>
              {row.status === 'open' && (
                <Button size="sm" className="ml-auto" onClick={() => resolveReport.mutate(row.id)}>
                  Resolve
                </Button>
              )}
            </div>
            <p className="mt-1.5 line-clamp-3 text-[12.5px] text-muted">{row.details}</p>
            <p className="mt-1 text-[11.5px] text-faint">{row.reporter_email ?? 'reporter deleted their account'}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-5 text-[13px] font-semibold text-muted">Contact messages</h3>
      <div className="mt-2 flex flex-col gap-2">
        {messages.data?.messages.length === 0 && <p className="text-[12.5px] text-faint">No messages.</p>}
        {messages.data?.messages.slice(0, 8).map((row) => (
          <div key={row.id} className="rounded-card border border-line bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={row.status === 'new' ? 'warning' : 'neutral'}>{row.status}</Badge>
              <span className="text-[13px] font-medium">{row.topic}</span>
              <span className="text-[12px] text-faint">
                {row.email} · {when(row.created_at)}
              </span>
              {row.status === 'new' && (
                <Button size="sm" className="ml-auto" onClick={() => readMessage.mutate(row.id)}>
                  Mark read
                </Button>
              )}
            </div>
            <p className="mt-1.5 line-clamp-3 text-[12.5px] text-muted">{row.message}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-5 text-[13px] font-semibold text-muted">Deletion requests</h3>
      <div className="mt-2 flex flex-col gap-2">
        {requests.data?.requests.length === 0 && <p className="text-[12.5px] text-faint">No requests.</p>}
        {requests.data?.requests.slice(0, 8).map((row) => (
          <div key={row.id} className="rounded-card border border-line bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={row.status === 'open' ? 'warning' : 'success'}>{row.status}</Badge>
              <span className="text-[13px] font-medium">{row.kind === 'delete_account' ? 'Delete account' : 'Delete data'}</span>
              <span className="text-[12px] text-faint">
                {row.email ?? 'no email'} · {when(row.created_at)}
              </span>
              {row.status === 'open' && (
                <Button size="sm" className="ml-auto" onClick={() => resolveRequest.mutate(row.id)}>
                  Resolve
                </Button>
              )}
            </div>
            {row.details && <p className="mt-1.5 line-clamp-3 text-[12.5px] text-muted">{row.details}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
