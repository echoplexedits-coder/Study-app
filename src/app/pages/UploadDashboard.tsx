import { useEffect, useMemo, useState } from 'react'

import { Archive, FileText, Image, Trash2, Upload, X } from 'lucide-react'
import { Button, ConfirmDialog, Input, useToast } from '../components/ui'
import { api } from '../lib/api'
import type { StorageUsage } from '../../shared/types'

interface UploadedFile {
  name: string
  size: number
  contentType: string | null
  uploadedAt: number
}

const FILE_ICON: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="size-5 text-danger" />,
  'application/msword': <FileText className="size-5 text-accent" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileText className="size-5 text-accent" />,
  'application/vnd.ms-powerpoint': <FileText className="size-5 text-warning" />,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': <FileText className="size-5 text-warning" />,
  'application/vnd.ms-excel': <FileText className="size-5 text-success" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileText className="size-5 text-success" />,
  'text/plain': <FileText className="size-5 text-muted" />,
  'text/csv': <FileText className="size-5 text-muted" />,
  'text/markdown': <FileText className="size-5 text-muted" />,
  'image/png': <Image className="size-5 text-success" />,
  'image/jpeg': <Image className="size-5 text-success" />,
  'image/webp': <Image className="size-5 text-success" />,
  'image/gif': <Image className="size-5 text-success" />,
}

function fileIcon(contentType: string | null) {
  return FILE_ICON[contentType ?? ''] ?? <Archive className="size-5 text-muted" />
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

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface ParsedFile {
  className: string
  subject: string
  date: string
  label: string
}

// Keys are stored as class/subject/date/name-uuid. Pull the class out so it can
// be a section heading, and drop that class prefix and the uuid from the row.
function parseFileKey(key: string): ParsedFile {
  const parts = key.split('/')
  const stored = parts.pop() ?? key
  const date = parts.length >= 3 ? (parts.pop() ?? '') : ''
  const subject = parts.length >= 2 ? (parts.pop() ?? '') : ''
  const className = parts.join('/') || 'Unsorted'
  const label = stored.replace(/-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '') || 'Untitled'
  return {
    className,
    subject: subject === 'General' ? '' : subject,
    date: date === 'undated' ? '' : date,
    label,
  }
}

export function UploadDashboard() {
  const toast = useToast()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [uploadingName, setUploadingName] = useState('')
  const [uploadingClass, setUploadingClass] = useState('')
  const [uploadingSubject, setUploadingSubject] = useState('')
  const [uploadingDate, setUploadingDate] = useState('')
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const sections = useMemo(() => {
    const grouped = new Map<string, { file: UploadedFile; meta: ParsedFile }[]>()
    for (const file of files) {
      const meta = parseFileKey(file.name)
      const entries = grouped.get(meta.className) ?? []
      entries.push({ file, meta })
      grouped.set(meta.className, entries)
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([className, entries]) => ({
        className,
        entries: entries.sort((a, b) => b.file.uploadedAt - a.file.uploadedAt),
      }))
  }, [files])

  const loadFiles = async () => {
    try {
      const body = await api<{ files: UploadedFile[]; usage: StorageUsage }>('/admin/files')
      setFiles(body.files)
      setUsage(body.usage)
    } catch {
      setFiles([])
      setUsage(null)
    }
  }

  // Load the existing files when the dashboard mounts. Without this the list
  // stayed empty until someone uploaded or deleted a file in the same visit.
  useEffect(() => {
    void loadFiles()
  }, [])

  const exceedsRemaining = Boolean(uploadingFile && usage && uploadingFile.size > usage.remaining)

  const uploadFile = async () => {
    if (!uploadingFile || !uploadingName.trim()) return
    if (usage && uploadingFile.size > usage.remaining) {
      toast('That file is larger than the remaining storage.', 'danger')
      return
    }
    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', uploadingFile)
      form.append('name', uploadingName.trim())
      form.append('class', uploadingClass.trim())
      form.append('subject', uploadingSubject.trim())
      form.append('date', uploadingDate.trim())
      await api('/admin/files', { method: 'POST', body: form })
      toast('File uploaded')
      setUploadingFile(null)
      const input = document.getElementById('classwork-file') as HTMLInputElement | null
      if (input) input.value = ''
      setUploadingName('')
      setUploadingClass('')
      setUploadingSubject('')
      setUploadingDate('')
      loadFiles()
    } catch (error) {
      toast((error as { message?: string }).message ?? 'Upload failed', 'danger')
    } finally {
      setLoading(false)
    }
  }

  const deleteFile = async (name: string) => {
    setDeleting(name)
    try {
      await api('/admin/files/' + encodeURIComponent(name), { method: 'DELETE' })
      toast('File deleted')
      setConfirmDelete(null)
      loadFiles()
    } catch {
      toast('Could not delete file', 'danger')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="rounded-card bg-surface shadow-card">
      <div className="p-5">
        <h3 className="text-[15px] font-semibold">Upload classwork</h3>
        <p className="mt-1 text-[12.5px] text-muted">
          Add documents, images, slides and notes for your class. Organize them by class, subject and date, and delete anything you no longer need.
        </p>
      </div>
      {usage && (
        <div className="border-t border-line px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-muted">Storage</h3>
            <span className="text-[12px] tabular-nums text-faint">
              {bytes(usage.bytes)} of {bytes(usage.limitBytes)} · {usage.files} {usage.files === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${usage.warning ? 'bg-warning' : 'bg-accent'}`}
              style={{ width: `${Math.min(100, usage.percent)}%` }}
            />
          </div>
          <p className={`mt-2 text-[12px] leading-relaxed ${usage.warning ? 'text-warning' : 'text-faint'}`}>
            {usage.remaining > 0 ? `${bytes(usage.remaining)} remaining.` : 'Storage is full; uploads are refused.'}
            {usage.warning && usage.remaining > 0 && ' Above 80% of the R2 limit — uploads will be refused once it is full.'}
          </p>
          <p className="mt-1 text-[11.5px] text-faint">
            Max {bytes(usage.maxFileSize)} per file. Request counts are not exposed to the app.
          </p>
        </div>
      )}
      <div className="border-t border-line px-5 py-4">
        <div className="flex flex-wrap gap-3">
          <Input
            type="text"
            value={uploadingName}
            onChange={(e) => setUploadingName(e.target.value)}
            placeholder="File name, e.g. Chapter 3 notes"
          />
          <Input
            type="text"
            value={uploadingClass}
            onChange={(e) => setUploadingClass(e.target.value)}
            placeholder="Class, e.g. Grade 10"
          />
          <Input
            type="text"
            value={uploadingSubject}
            onChange={(e) => setUploadingSubject(e.target.value)}
            placeholder="Subject, e.g. Biology"
          />
          <Input
            type="date"
            value={uploadingDate}
            onChange={(e) => setUploadingDate(e.target.value)}
          />
          <input
            type="file"
            className="hidden"
            id="classwork-file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md,.rtf,.epub,image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setUploadingFile(file)
                setUploadingName(file.name.replace(/\.[^.]+$/, ''))
              }
            }}
          />
          <Button
            type="button"
            variant="primary"
            onClick={() => document.getElementById('classwork-file')?.click()}
            disabled={loading}
          >
            {uploadingFile ? <><Upload className="size-4" /> Replace file</> : <><Upload className="size-4" /> Choose file</>}
          </Button>
          {uploadingFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setUploadingFile(null)
                setUploadingName('')
                const input = document.getElementById('classwork-file') as HTMLInputElement | null
                if (input) input.value = ''
              }}
            >
              <X className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            loading={loading}
            disabled={!uploadingFile || !uploadingName.trim() || exceedsRemaining}
            onClick={uploadFile}
          >
            Upload
          </Button>
        </div>
        {uploadingFile && (
          <p className="mt-2 text-[12.5px] text-muted">
            {uploadingFile.name} · {bytes(uploadingFile.size)}
          </p>
        )}
        {exceedsRemaining && (
          <p className="mt-1 text-[12.5px] text-danger">This file is larger than the remaining storage. Delete a file or choose a smaller one.</p>
        )}
      </div>
      <div className="border-t border-line px-5 py-4">
        <h3 className="text-[13px] font-semibold text-muted">Uploaded files</h3>
        {files.length === 0 && (
          <p className="mt-2 text-[12.5px] text-faint">No classwork uploaded yet.</p>
        )}
        {sections.map(({ className, entries }) => (
          <section key={className} className="mt-5 first:mt-3">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-[13px] font-semibold">{className}</h4>
              <span className="text-[12px] text-faint">
                {entries.length} {entries.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <ul className="mt-1 divide-y divide-line">
              {entries.map(({ file, meta }) => (
                <li key={file.name} className="flex items-center gap-3 py-3">
                  <span className="shrink-0">{fileIcon(file.contentType)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{meta.label}</p>
                    <p className="truncate text-[12px] text-muted">
                      {[meta.subject, meta.date, bytes(file.size)].filter(Boolean).join(' · ')} · {formatDate(file.uploadedAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${meta.label}`}
                    loading={deleting === file.name}
                    onClick={() => setConfirmDelete(file.name)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => deleteFile(confirmDelete!)}
        loading={deleting !== null}
        title="Delete this file?"
        description="This removes the file from storage. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}
