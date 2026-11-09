import { ArrowLeft, Brain, Check, FileText, ImagePlus, Layers, MoreHorizontal, Paperclip, Pencil, Plus, Shuffle, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { ProgressRing } from '../components/DeckCard'
import { Button, ConfirmDialog, Dialog, Field, FieldInput, FieldTextarea, Input, Menu, Spinner, useToast } from '../components/ui'
import { api, deleteDeckCover, uploadCardAttachment, uploadDeckCover, useApiMutation, useDeck, useMe } from '../lib/api'
import { cx } from '../lib/cx'
import { relativeTime } from '../lib/format'
import { parseCards } from './Library'
import { MAX_ATTACHMENT_BYTES, MAX_COVER_BYTES, type Card } from '../../shared/types'

const modes = [
  { key: 'flashcards', label: 'Flashcards', detail: 'Flip through and sort what you know', icon: Layers },
  { key: 'learn', label: 'Learn', detail: 'Multiple choice, focused on weak cards', icon: Brain },
  { key: 'match', label: 'Match', detail: 'Pair terms and definitions against the clock', icon: Shuffle },
] as const

export function Deck() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, isError } = useDeck(id)
  const { data: me } = useMe()
  const canEdit = me?.capabilities.canEdit ?? false
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingCard, setEditingCard] = useState<Card | null>(null)
  const [deletingCard, setDeletingCard] = useState<Card | null>(null)

  // Deleting a deck or a card can free attachments, so the storage total is
  // invalidated with them; otherwise Settings keeps reporting the old usage.
  const remove = useApiMutation(() => api(`/decks/${id}`, { method: 'DELETE' }), ['decks', 'stats', 'me', 'storage'], { onSuccess: () => navigate('/') })
  const removeCard = useApiMutation((cardId: string) => api(`/decks/${id}/cards/${cardId}`, { method: 'DELETE' }), ['deck', 'decks', 'storage'])
  const attachFile = useApiMutation((input: { cardId: string; file: File }) => uploadCardAttachment(id!, input.cardId, input.file), ['deck', 'storage'], {
    onSuccess: () => toast('Attachment added'),
    onError: (error) => toast(error.message),
  })
  const removeAttachment = useApiMutation((cardId: string) => api(`/decks/${id}/cards/${cardId}/file`, { method: 'DELETE' }), ['deck', 'storage'])
  const fileInput = useRef<HTMLInputElement>(null)
  const [attachTarget, setAttachTarget] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner />
      </div>
    )
  }
  // A missing deck (deleted, or another account's link) must not spin forever.
  if (isError || !data) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div>
          <p className="text-[15px] font-medium">This deck is not available</p>
          <p className="mt-1 text-[13.5px] text-muted">It may have been deleted, or it belongs to another account.</p>
          <Link to="/" className="mt-5 inline-flex h-9 items-center rounded-control bg-surface px-4 text-[13.5px] font-medium shadow-card hover:bg-surface-2">
            Back to library
          </Link>
        </div>
      </div>
    )
  }
  const { deck, cards, sessions } = data
  const weak = cards.filter((c) => c.progress.mastery < 40).length

  return (
    <div>
      <Link to="/" className="inline-flex h-8 items-center gap-1.5 text-[13.5px] text-muted hover:text-fg">
        <ArrowLeft className="size-4" />
        Library
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="relative grid place-items-center">
            <ProgressRing value={deck.mastery} size={64} stroke={5} hue={deck.hue} />
            <span className="absolute text-[13px] font-bold tabular-nums">{deck.mastery}%</span>
          </div>
          <div>
            <h1 className="text-[24px] font-bold tracking-[-0.02em] sm:text-[28px]">{deck.title}</h1>
            {deck.description && <p className="mt-1 max-w-xl text-[14.5px] text-muted">{deck.description}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-faint">
              <span>{deck.cardCount} cards</span>
              <span>{deck.mastered} mastered</span>
              {weak > 0 && <span className="text-warning">{weak} still learning</span>}
              {deck.lastStudiedAt && <span>Studied {relativeTime(deck.lastStudiedAt)}</span>}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setAdding(true)}>
              <Plus />
              Add cards
            </Button>
            <Menu
              trigger={
                <Button size="icon" aria-label="More">
                  <MoreHorizontal />
                </Button>
              }
              items={[
                { label: 'Edit deck', icon: <Pencil />, onSelect: () => setEditing(true) },
                { label: 'Delete deck', icon: <Trash2 />, danger: true, onSelect: () => setDeleting(true) },
              ]}
            />
          </div>
        )}
      </header>

      {deck.hasCover && (
        <img
          src={`/api/decks/${deck.id}/cover?v=${deck.coverVersion ?? ''}`}
          alt=""
          className="mt-4 h-36 w-full rounded-card object-cover shadow-card sm:h-44"
        />
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {modes.map(({ key, label, detail, icon: Icon }) => {
          const needed = key === 'match' ? 3 : key === 'learn' ? 4 : 1
          const disabled = cards.length < needed
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => navigate(`/decks/${deck.id}/${key}`)}
              className="group flex h-[108px] flex-col justify-between rounded-card bg-surface p-4 text-left shadow-card transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-pop disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="grid size-9 place-items-center rounded-[12px] bg-accent-soft text-accent">
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{label}</span>
                <span className="block text-[12.5px] text-muted">{disabled ? `Needs at least ${needed} ${needed === 1 ? 'card' : 'cards'}` : detail}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-muted">Cards</h2>
        {sessions[0] && (
          <span className="text-[13px] text-faint">
            Last session {sessions[0].accuracy}% in {sessions[0].mode}
          </span>
        )}
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {cards.map((card, i) => (
          <li key={card.id} className="group grid grid-cols-1 items-center gap-2 rounded-card bg-surface px-4 py-3.5 shadow-card sm:grid-cols-[1fr_1fr_auto] sm:gap-4 sm:px-5">
            <div className="flex items-start gap-4">
              <span className="w-6 shrink-0 pt-0.5 text-[12px] tabular-nums text-faint">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-medium leading-snug">{card.term}</p>
                {card.hasImage ? (
                  <img src={`/api/decks/${deck.id}/cards/${card.id}/file?v=${card.fileVersion ?? ''}`} alt="" loading="lazy" decoding="async" className="mt-2 h-20 w-28 rounded-[12px] object-cover" />
                ) : card.fileName ? (
                  <a
                    href={`/api/decks/${deck.id}/cards/${card.id}/file?v=${card.fileVersion ?? ''}`}
                    download={card.fileName}
                    className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-tile bg-surface-2 px-2.5 py-1.5 text-[12.5px] font-medium text-muted hover:text-fg"
                  >
                    <FileText className="size-3.5 shrink-0" />
                    <span className="truncate">{card.fileName}</span>
                  </a>
                ) : null}
              </div>
            </div>
            <p className="text-[14.5px] leading-snug text-muted sm:border-l sm:border-line sm:pl-4">{card.definition}</p>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              {/* Row actions stay visible on touch screens, where there is no hover. */}
              <div className="flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                {canEdit && me?.capabilities.files && (
                  <button
                    type="button"
                    aria-label={card.hasImage || card.fileName ? 'Remove attachment' : 'Attach a file'}
                    onClick={() => {
                      if (card.hasImage || card.fileName) removeAttachment.mutate(card.id)
                      else {
                        setAttachTarget(card.id)
                        fileInput.current?.click()
                      }
                    }}
                    className={cx('grid size-9 place-items-center rounded-tile text-faint hover:bg-surface-2 hover:text-fg sm:size-8', Boolean(card.hasImage || card.fileName) && 'text-accent')}
                  >
                    <Paperclip className="size-4" />
                  </button>
                )}
                {canEdit && (
                  <>
                    <button type="button" aria-label="Edit card" onClick={() => setEditingCard(card)} className="grid size-9 place-items-center rounded-tile text-faint hover:bg-surface-2 hover:text-fg sm:size-8">
                      <Pencil className="size-4" />
                    </button>
                    <button type="button" aria-label="Delete card" onClick={() => setDeletingCard(card)} className="grid size-9 place-items-center rounded-tile text-faint hover:bg-surface-2 hover:text-danger sm:size-8">
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
              <span className="w-[88px] text-right"><MasteryPill value={card.progress.mastery} /></span>
            </div>
          </li>
        ))}
        {cards.length === 0 && (
          <li className="rounded-card border-2 border-dashed border-line-strong py-12 text-center">
            <p className="text-[15px] font-medium">{canEdit ? 'No cards yet' : 'No cards published here yet'}</p>
            {canEdit && (
              <Button variant="primary" className="mt-4" onClick={() => setAdding(true)}>
                <Plus />
                Add cards
              </Button>
            )}
          </li>
        )}
      </ul>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.md,.rtf,.epub"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && attachTarget) {
            if (file.size > MAX_ATTACHMENT_BYTES) toast(`Files are limited to ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`)
            else attachFile.mutate({ cardId: attachTarget, file })
          }
          e.target.value = ''
        }}
      />

      <AddCardsDialog open={adding} onClose={() => setAdding(false)} deckId={deck.id} />
      <EditDeckDialog open={editing} onClose={() => setEditing(false)} deckId={deck.id} title={deck.title} description={deck.description ?? ''} coverVersion={deck.coverVersion} />
      <EditCardDialog card={editingCard} deckId={deck.id} onClose={() => setEditingCard(null)} />
      <ConfirmDialog
        open={Boolean(deletingCard)}
        onClose={() => setDeletingCard(null)}
        onConfirm={() => {
          if (deletingCard) removeCard.mutate(deletingCard.id)
          setDeletingCard(null)
        }}
        loading={removeCard.isPending}
        title="Delete this card?"
        description={deletingCard ? `“${deletingCard.term}” and its progress are removed.` : ''}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate(undefined)}
        loading={remove.isPending}
        title={`Delete ${deck.title}?`}
        description="All its cards, progress and session history are removed."
      />
    </div>
  )
}

export function MasteryPill({ value }: { value: number }) {
  const tone = value >= 80 ? 'bg-success-soft text-success' : value >= 40 ? 'bg-warning-soft text-warning' : value > 0 ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-faint'
  const label = value >= 80 ? 'Mastered' : value >= 40 ? 'Learning' : value > 0 ? 'Weak' : 'New'
  return <span className={cx('inline-flex h-6 items-center gap-1 rounded-[8px] px-2 text-[12px] font-medium', tone)}>{value >= 80 && <Check className="size-3" />}{label}</span>
}

function AddCardsDialog({ open, onClose, deckId }: { open: boolean; onClose: () => void; deckId: string }) {
  const toast = useToast()
  const [rows, setRows] = useState([{ term: '', definition: '' }])
  const [bulk, setBulk] = useState('')
  const [tab, setTab] = useState<'one' | 'bulk'>('one')
  const cards = tab === 'one' ? rows.filter((r) => r.term.trim() && r.definition.trim()) : parseCards(bulk)
  const add = useApiMutation(() => api<{ added: number }>(`/decks/${deckId}/cards`, { method: 'POST', json: { cards } }), ['deck', 'decks'], {
    onSuccess: (r) => {
      toast(`${r.added} ${r.added === 1 ? 'card' : 'cards'} added`)
      setRows([{ term: '', definition: '' }])
      setBulk('')
      onClose()
    },
  })
  function submit(e: FormEvent) {
    e.preventDefault()
    if (cards.length) add.mutate(undefined)
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add cards"
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="add-cards" loading={add.isPending} disabled={cards.length === 0}>
            Add {cards.length > 0 ? cards.length : ''} {cards.length === 1 ? 'card' : 'cards'}
          </Button>
        </>
      }
    >
      <div className="grid h-9 grid-cols-2 rounded-control bg-surface-2 p-1 text-[13px] font-medium">
        {(['one', 'bulk'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cx('rounded-[10px] transition-colors', tab === t ? 'bg-surface shadow-card' : 'text-muted')}>
            {t === 'one' ? 'One by one' : 'Paste a list'}
          </button>
        ))}
      </div>
      <form id="add-cards" onSubmit={submit} className="mt-4">
        {tab === 'one' ? (
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input aria-label="Term" placeholder="Term" value={row.term} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, term: e.target.value } : r)))} />
                <Button size="icon" variant="ghost" className="sm:order-3" aria-label="Remove row" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <X />
                </Button>
                <Input
                  aria-label="Definition"
                  placeholder="Definition"
                  className="col-span-2 sm:order-2 sm:col-span-1"
                  value={row.definition}
                  onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, definition: e.target.value } : r)))}
                />
              </div>
            ))}
            <Button variant="ghost" className="self-start" onClick={() => setRows([...rows, { term: '', definition: '' }])}>
              <Plus />
              Another card
            </Button>
          </div>
        ) : (
          <Field label="Cards" hint="One per line: term, then a dash, colon or tab, then the definition.">
            <FieldTextarea value={bulk} onChange={(e) => setBulk(e.target.value)} className="min-h-[180px] font-mono text-[13px]" placeholder={'photosynthesis - how plants make food from light\nosmosis - water moving across a membrane'} />
          </Field>
        )}
        {add.error && <p className="mt-3 text-[13px] text-danger">{add.error.message}</p>}
      </form>
    </Dialog>
  )
}

function EditDeckDialog({
  open,
  onClose,
  deckId,
  title,
  description,
  coverVersion,
}: {
  open: boolean
  onClose: () => void
  deckId: string
  title: string
  description: string
  coverVersion: string | null
}) {
  const toast = useToast()
  const [form, setForm] = useState({ title, description })
  const [coverError, setCoverError] = useState('')
  const coverInput = useRef<HTMLInputElement>(null)
  const coverMb = Math.round(MAX_COVER_BYTES / (1024 * 1024))

  // Reopening the dialog should show the deck as it is now, not the values from
  // the first time this component was mounted.
  useEffect(() => {
    if (open) {
      setForm({ title, description })
      setCoverError('')
    }
  }, [open, title, description])

  const save = useApiMutation(() => api(`/decks/${deckId}`, { method: 'PATCH', json: form }), ['deck', 'decks'], { onSuccess: onClose })
  const attachCover = useApiMutation((file: File) => uploadDeckCover(deckId, file), ['deck', 'decks', 'storage'], {
    onSuccess: () => {
      setCoverError('')
      toast('Cover updated')
    },
    onError: (error) => toast(error.message, 'danger'),
  })
  const removeCover = useApiMutation(() => deleteDeckCover(deckId), ['deck', 'decks', 'storage'], {
    onSuccess: () => toast('Cover removed'),
    onError: (error) => toast(error.message, 'danger'),
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit deck"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!form.title.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Title">
          <FieldInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <FieldInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Cover image" hint={`PNG, JPEG, WebP or GIF up to ${coverMb} MB.`}>
          <div className="flex flex-wrap items-center gap-3">
            {coverVersion ? (
              <img src={`/api/decks/${deckId}/cover?v=${coverVersion}`} alt="Current cover" className="size-14 rounded-[13px] object-cover" />
            ) : (
              <span className="grid size-14 place-items-center rounded-[13px] bg-surface-2 text-faint">
                <ImagePlus className="size-5" />
              </span>
            )}
            <Button type="button" onClick={() => coverInput.current?.click()} loading={attachCover.isPending}>
              {coverVersion ? 'Replace image' : 'Add image'}
            </Button>
            {coverVersion && (
              <Button type="button" variant="danger" onClick={() => removeCover.mutate(undefined)} loading={removeCover.isPending}>
                Remove
              </Button>
            )}
          </div>
          <input
            ref={coverInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
              const looksLikeImage = file.type ? file.type.startsWith('image/') : ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)
              if (!looksLikeImage) {
                setCoverError('Choose a PNG, JPEG, WebP or GIF image.')
                return
              }
              if (file.size > MAX_COVER_BYTES) {
                setCoverError(`Cover images are limited to ${coverMb} MB.`)
                return
              }
              setCoverError('')
              attachCover.mutate(file)
            }}
          />
          {coverError && <p className="text-[12.5px] text-danger">{coverError}</p>}
        </Field>
      </div>
    </Dialog>
  )
}

function EditCardDialog({ card, deckId, onClose }: { card: Card | null; deckId: string; onClose: () => void }) {
  const [form, setForm] = useState({ term: '', definition: '' })
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (card && loadedFor !== card.id) {
    setForm({ term: card.term, definition: card.definition })
    setLoadedFor(card.id)
  }
  const save = useApiMutation(() => api(`/decks/${deckId}/cards/${card?.id}`, { method: 'PATCH', json: form }), ['deck'], { onSuccess: onClose })
  return (
    <Dialog
      open={Boolean(card)}
      onClose={onClose}
      title="Edit card"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => save.mutate(undefined)} loading={save.isPending} disabled={!form.term.trim() || !form.definition.trim()}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Term">
          <FieldInput value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} />
        </Field>
        <Field label="Definition">
          <FieldTextarea value={form.definition} onChange={(e) => setForm({ ...form, definition: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  )
}
