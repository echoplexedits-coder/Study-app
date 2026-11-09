import { motion } from 'motion/react'
import { ArrowUpRight, Download, ExternalLink, FileText, FolderOpen, Image as ImageIcon, Layers, Lock, Search, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { NoteFile } from '../../shared/types'
import { Badge, Button, Dialog, EmptyState, Skeleton } from '../components/ui'
import { noteUrl, useMe, useNotes } from '../lib/api'
import { cx } from '../lib/cx'
import { formatBytes, formatDate } from '../lib/format'

const ease = [0.22, 1, 0.36, 1] as const

function kindOf(contentType: string | null): { label: string; icon: typeof FileText } {
  if (!contentType) return { label: 'File', icon: FileText }
  if (contentType.startsWith('image/')) return { label: 'Image', icon: ImageIcon }
  if (contentType === 'application/pdf') return { label: 'PDF', icon: FileText }
  if (contentType.includes('word')) return { label: 'Document', icon: FileText }
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return { label: 'Slides', icon: Layers }
  if (contentType.includes('sheet') || contentType.includes('excel') || contentType === 'text/csv') return { label: 'Sheet', icon: Layers }
  if (contentType.startsWith('text/')) return { label: 'Text', icon: FileText }
  return { label: 'File', icon: FolderOpen }
}

/** Only these three families render inside the page; the rest open elsewhere. */
function previewKind(note: NoteFile) {
  const type = note.contentType ?? ''
  if (type.startsWith('image/')) return 'image' as const
  if (type === 'application/pdf') return 'pdf' as const
  if (type.startsWith('text/') || type === 'application/markdown' || type === 'text/markdown') return 'text' as const
  return 'none' as const
}

export function Notes() {
  const { data: me } = useMe()
  const { data, isLoading, isError, refetch, isRefetching } = useNotes()
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('all')
  const [className, setClassName] = useState('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  const files = data?.files ?? []

  const subjects = useMemo(() => {
    const set = new Set<string>()
    for (const file of files) if (file.subject) set.add(file.subject)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [files])

  const classes = useMemo(() => {
    const set = new Set<string>()
    for (const file of files) set.add(file.className)
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [files])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return files.filter((file) => {
      if (subject !== 'all' && file.subject !== subject) return false
      if (className !== 'all' && file.className !== className) return false
      if (!needle) return true
      return `${file.name} ${file.subject} ${file.className} ${file.contentType ?? ''}`.toLowerCase().includes(needle)
    })
  }, [files, query, subject, className])

  const selected = filtered.find((file) => file.key === selectedKey) ?? filtered[0] ?? null
  const filtering = query.trim().length > 0 || subject !== 'all' || className !== 'all'

  function choose(file: NoteFile) {
    setSelectedKey(file.key)
    // Below the two-pane breakpoint there is no side panel, so the pick opens a
    // sheet instead. On a wide screen the side panel already shows the preview.
    if (window.matchMedia('(max-width: 1023px)').matches) setMobileOpen(true)
  }

  function clearFilters() {
    setQuery('')
    setSubject('all')
    setClassName('all')
  }

  return (
    <div className="pb-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-accent">The library</p>
          <h1 className="mt-2 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] text-fg-deep sm:text-[38px]">Class notes</h1>
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
            Everything the class has been given, filed by class and subject. Search it, preview it, take a copy with you.
          </p>
        </div>
        <Badge tone={me?.capabilities.canEdit ? 'accent' : 'neutral'} className="mb-1">
          <Lock className="size-3" aria-hidden />
          {me?.capabilities.canEdit ? 'Admin — can upload' : 'Read-only access'}
        </Badge>
      </header>

      <div className="mt-7 rounded-panel border border-line/80 bg-surface/80 p-3 shadow-card backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search notes</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, subject or type"
              className="h-11 w-full rounded-control border border-line-strong bg-surface pl-10 pr-10 text-[13.5px] text-fg placeholder:text-faint transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" aria-hidden />
              <select
                aria-label="Filter by class"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
                className="h-11 w-full appearance-none rounded-control border border-line-strong bg-surface pl-9 pr-8 text-[13px] font-medium text-fg transition-colors hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15 sm:w-[168px]"
              >
                <option value="all">All classes</option>
                {classes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            {filtering && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
                Reset
              </Button>
            )}
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={subject === 'all'} onClick={() => setSubject('all')}>
              All subjects
            </FilterChip>
            {subjects.map((item) => (
              <FilterChip key={item} active={subject === item} onClick={() => setSubject(item)}>
                {item}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] text-faint">
          {isLoading ? 'Loading the library…' : `${filtered.length} ${filtered.length === 1 ? 'document' : 'documents'}${filtering ? ' match' : ''}`}
        </p>
        {isRefetching && <span className="text-[11.5px] text-faint">Refreshing…</span>}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,392px)] lg:items-start">
        <div className="min-w-0">
          {isLoading && (
            <div className="grid gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[74px] rounded-card" />
              ))}
            </div>
          )}

          {isError && (
            <EmptyState
              icon={<FolderOpen />}
              title="The library didn't load"
              description="This is usually a connection problem. Your notes are still there."
              action={<Button onClick={() => void refetch()}>Try again</Button>}
            />
          )}

          {!isLoading && !isError && files.length === 0 && (
            <div className="rounded-panel border border-dashed border-line-strong bg-surface/60">
              <EmptyState
                icon={<FileText />}
                title="No notes uploaded yet"
                description="When the class admin uploads a document it appears here, filed by class and subject."
              />
            </div>
          )}

          {!isLoading && !isError && files.length > 0 && filtered.length === 0 && (
            <div className="rounded-panel border border-dashed border-line-strong bg-surface/60">
              <EmptyState
                icon={<Search />}
                title="Nothing matches those filters"
                description="Try a shorter search, or reset the class and subject filters."
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            </div>
          )}

          {filtered.length > 0 && (
            <ul className="grid gap-2">
              {filtered.map((file, index) => {
                const kind = kindOf(file.contentType)
                const Icon = kind.icon
                const active = selected?.key === file.key
                return (
                  <motion.li
                    key={file.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, ease, delay: Math.min(index, 8) * 0.025 }}
                  >
                    <button
                      type="button"
                      onClick={() => choose(file)}
                      aria-current={active ? 'true' : undefined}
                      className={cx(
                        'group flex w-full items-center gap-3.5 rounded-card border px-3.5 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200',
                        active
                          ? 'border-accent/30 bg-accent-soft/45 shadow-card'
                          : 'border-line/70 bg-surface hover:-translate-y-px hover:border-line-strong hover:shadow-card',
                      )}
                    >
                      <span
                        className={cx(
                          'grid size-11 shrink-0 place-items-center rounded-tile border transition-colors',
                          active ? 'border-accent/25 bg-surface text-accent' : 'border-line/60 bg-surface-2 text-muted group-hover:text-accent',
                        )}
                      >
                        <Icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-fg-deep">{file.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-faint">
                          <span>{kind.label}</span>
                          {file.subject && <span aria-hidden>·</span>}
                          {file.subject && <span>{file.subject}</span>}
                          <span aria-hidden>·</span>
                          <span>{file.className}</span>
                          <span aria-hidden>·</span>
                          <span>{formatBytes(file.size)}</span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-[11.5px] text-faint sm:block">{formatDate(file.uploadedAt)}</span>
                      <ArrowUpRight className="size-4 shrink-0 text-faint transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          )}
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <PreviewPanel note={selected} />
        </aside>
      </div>

      {/* Mobile: the preview opens in a sheet so the list keeps the screen. */}
      <Dialog open={mobileOpen && selected !== null} onClose={() => setMobileOpen(false)} title="Preview" description={selected ? `${selected.className}${selected.subject ? ` · ${selected.subject}` : ''}` : undefined} width={560}>
        {selected && <PreviewBody note={selected} compact />}
      </Dialog>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[12px] font-medium transition-colors duration-200',
        active ? 'border-accent/30 bg-accent text-white shadow-[0_8px_18px_-12px_rgb(23_65_159/0.9)]' : 'border-line/80 bg-surface text-muted hover:border-line-strong hover:text-fg-deep',
      )}
    >
      {children}
    </button>
  )
}

function PreviewPanel({ note }: { note: NoteFile | null }) {
  return (
    <div className="overflow-hidden rounded-panel border border-line/80 bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">Preview</p>
        {note && <span className="text-[11px] text-faint">{formatDate(note.uploadedAt)}</span>}
      </div>
      {note ? <PreviewBody note={note} /> : <PreviewPlaceholder />}
    </div>
  )
}

function PreviewPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-card bg-surface-2 text-faint">
        <FileText className="size-5" />
      </span>
      <p className="text-[13.5px] font-medium text-fg-deep">Choose a document</p>
      <p className="max-w-[26ch] text-[12.5px] leading-relaxed text-faint">Select anything on the left to see its details and a preview.</p>
    </div>
  )
}

function PreviewBody({ note, compact = false }: { note: NoteFile; compact?: boolean }) {
  const kind = previewKind(note)
  const info = kindOf(note.contentType)
  const Icon = info.icon
  const href = noteUrl(note.key)

  return (
    <div className={cx('flex flex-col', compact ? 'gap-3' : 'gap-3 p-4')}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-accent-soft text-accent">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-fg-deep">{note.name}</p>
          <p className="mt-0.5 text-[11.5px] text-faint">
            {[info.label, note.subject, note.className, formatBytes(note.size)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className={cx('overflow-hidden rounded-tile border border-line/80 bg-surface-2', compact ? 'h-[46vh]' : 'h-[300px] xl:h-[360px]')}>
        {kind === 'image' && <img src={href} alt={note.name} loading="lazy" decoding="async" className="size-full object-contain" />}
        {kind === 'pdf' && <iframe src={href} title={`Preview of ${note.name}`} className="size-full border-0 bg-white" loading="lazy" />}
        {kind === 'text' && <iframe src={href} title={`Preview of ${note.name}`} className="size-full border-0 bg-white" loading="lazy" />}
        {kind === 'none' && (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
            <FolderOpen className="size-6 text-faint" aria-hidden />
            <p className="text-[12.5px] font-medium text-fg-deep">No in-page preview for this format</p>
            <p className="max-w-[28ch] text-[11.5px] leading-relaxed text-faint">Open it in a new tab or download a copy to read it in its own app.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control bg-accent px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-deep"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Open
        </a>
        <a
          href={noteUrl(note.key, true)}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 text-[12.5px] font-semibold text-fg transition-colors hover:bg-surface-2"
        >
          <Download className="size-3.5" aria-hidden />
          Download
        </a>
      </div>
      {note.date && <p className="text-[11px] text-faint">Dated {formatDate(new Date(`${note.date}T00:00:00`).getTime())}</p>}
    </div>
  )
}
