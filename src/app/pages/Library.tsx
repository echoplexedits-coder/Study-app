import { ArrowRight, BookOpen, FileText, FolderOpen, ImagePlus, ListChecks, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { DeckCard } from '../components/DeckCard'
import { Button, Dialog, EmptyState, Field, FieldInput, FieldTextarea, Skeleton, useToast } from '../components/ui'
import { api, uploadDeckCover, useApiMutation, useDecks, useInvalidate, useMe } from '../lib/api'
import { deckGradient } from '../lib/format'
import { MAX_COVER_BYTES, type Deck } from '../../shared/types'

export function Library() {
  const { data: me } = useMe()
  const canEdit = me?.capabilities.canEdit ?? false
  const { data, isLoading, isError } = useDecks()
  const [creating, setCreating] = useState(false)
  const decks = data?.items ?? []
  const due = decks.reduce((n, d) => n + d.dueCount, 0)
  const next = decks.find((d) => d.dueCount > 0) ?? decks[0]
  const first = me?.user.name?.split(' ')[0]
  const hour = new Date().getHours()

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-accent">Your library</p>
          <h1 className="mt-2 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] text-fg-deep sm:text-[38px]">
            {hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}
            {first ? `, ${first}` : ''}
          </h1>
          <p className="mt-2 text-[13.5px] text-muted">{due > 0 ? `${due} ${due === 1 ? 'card is' : 'cards are'} due for review` : 'Nothing due. A good day to learn something new.'}</p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus />
            New deck
          </Button>
        )}
      </div>

      {next && (
        <Link
          to={next.cardCount >= 4 ? `/decks/${next.id}/learn` : `/decks/${next.id}`}
          className="group mt-8 flex items-center gap-5 rounded-card bg-fg p-5 text-white shadow-float transition-transform hover:-translate-y-0.5 sm:p-6"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-[18px] text-[20px] font-bold shadow-[0_12px_24px_-16px_rgb(0_0_0/0.9)]" style={{ background: deckGradient(next.hue) }}>
            {next.title[0]?.toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-white/60">{next.dueCount > 0 ? 'Continue where you left off' : 'Keep it fresh'}</span>
            <span className="mt-0.5 block truncate text-[18px] font-semibold">{next.title}</span>
            <span className="mt-0.5 block text-[13px] text-white/60">
              {next.dueCount > 0 ? `${next.dueCount} cards due` : `${next.cardCount} cards`}, about {Math.max(2, Math.ceil((next.dueCount || next.cardCount) / 5))} minutes
            </span>
          </span>
          <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-white text-fg transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="size-4" />
          </span>
        </Link>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { to: '/notes', icon: FileText, label: 'Class notes', copy: 'Uploaded handouts and slides' },
          { to: '/resources', icon: FolderOpen, label: 'Resources', copy: 'Decks and study material' },
          { to: '/quizzes', icon: ListChecks, label: 'Practice', copy: 'Flashcards, learn and match' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center gap-3 rounded-card border border-line/70 bg-surface/80 px-4 py-3 shadow-card transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-accent/25 hover:shadow-pop"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-surface-2 text-accent transition-colors group-hover:bg-accent-soft">
              <item.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-fg-deep">{item.label}</span>
              <span className="block truncate text-[11.5px] text-faint">{item.copy}</span>
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[14px] font-semibold text-muted">{canEdit ? 'Your decks' : 'Class library'}</h2>
        {!canEdit && <span className="text-[12.5px] text-faint">Read-only — the site admin maintains these decks</span>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[168px] rounded-card" />)}
        {decks.map((d, i) => (
          <DeckCard key={d.id} deck={d} index={i} />
        ))}
        {canEdit && !isLoading && decks.length > 0 && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-[168px] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong text-muted transition-colors hover:border-accent hover:text-accent"
          >
            <Plus className="size-5" />
            <span className="text-[14px] font-medium">New deck</span>
          </button>
        )}
      </div>
      {data && decks.length === 0 && (
        <EmptyState
          icon={<BookOpen />}
          title={canEdit ? 'Your library is empty' : 'Nothing published yet'}
          description={canEdit ? 'Create a deck and add a few cards to get started.' : 'The site admin has not published any decks yet. Check back soon.'}
        />
      )}
      {isError && (
        <EmptyState
          icon={<BookOpen />}
          title="Couldn't load your decks"
          description="Check your connection and try again."
          action={<Button onClick={() => window.location.reload()}>Reload</Button>}
        />
      )}

      <NewDeckDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

export function parseCards(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [term, ...rest] = line.split(/\s+[-–—:]\s+|\t/)
      return { term: term.trim(), definition: rest.join(' ').trim() }
    })
    .filter((c) => c.term && c.definition)
}

export function NewDeckDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cardsText, setCardsText] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [coverError, setCoverError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const invalidate = useInvalidate()
  const coverMb = Math.round(MAX_COVER_BYTES / (1024 * 1024))

  // The preview URL belongs to this selected file; revoke it when it changes or
  // the dialog unmounts so a large image is not kept alive by the browser.
  useEffect(() => {
    if (!cover) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(cover)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [cover])

  function reset() {
    setTitle('')
    setDescription('')
    setCardsText('')
    setCover(null)
    setCoverError('')
    if (coverInput.current) coverInput.current.value = ''
  }

  function close() {
    reset()
    onClose()
  }

  const create = useApiMutation(
    () => api<{ deck: Deck }>('/decks', { method: 'POST', json: { title, description, cards: parseCards(cardsText) } }),
    ['decks', 'me', 'storage'],
    {
      onSuccess: async (result) => {
        let coverFailed = ''
        if (cover) {
          try {
            await uploadDeckCover(result.deck.id, cover)
            // The create mutation refreshed the library before the cover
            // existed, so refresh it again after the upload.
            await invalidate('decks', 'deck', 'storage')
          } catch (error) {
            coverFailed = (error as Error).message
          }
        }
        toast(coverFailed ? `Deck created, but the cover upload failed: ${coverFailed}` : 'Deck created', coverFailed ? 'danger' : 'neutral')
        reset()
        onClose()
        navigate(`/decks/${result.deck.id}`)
      },
    },
  )
  const parsed = parseCards(cardsText)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (coverError) return
    create.mutate(undefined)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New deck"
      width={520}
      footer={
        <>
          <Button onClick={close} disabled={create.isPending}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-deck" loading={create.isPending} disabled={!title.trim() || Boolean(coverError)}>
            Create{parsed.length > 0 ? ` with ${parsed.length} cards` : ''}
          </Button>
        </>
      }
    >
      <form id="new-deck" onSubmit={submit} className="grid gap-4">
        <Field label="Title">
          <FieldInput required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Spanish essentials" />
        </Field>
        <Field label="Description">
          <FieldInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Cover image" hint={`Optional. PNG, JPEG, WebP or GIF up to ${coverMb} MB.`}>
          <div className="flex flex-wrap items-center gap-3">
            {preview ? (
              <img src={preview} alt="Selected cover preview" className="size-14 rounded-[13px] object-cover" />
            ) : (
              <span className="grid size-14 place-items-center rounded-[13px] bg-surface-2 text-faint">
                <ImagePlus className="size-5" />
              </span>
            )}
            <Button type="button" onClick={() => coverInput.current?.click()} disabled={create.isPending}>
              {cover ? 'Replace image' : 'Choose image'}
            </Button>
            {cover && (
              <Button
                type="button"
                variant="ghost"
                disabled={create.isPending}
                onClick={() => {
                  setCover(null)
                  setCoverError('')
                  if (coverInput.current) coverInput.current.value = ''
                }}
              >
                <X />
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
              setCover(file)
            }}
          />
          {coverError && <p className="text-[12.5px] text-danger">{coverError}</p>}
        </Field>
        <Field label="Cards" hint="One per line, term and definition separated by a dash, colon or tab. You can also add them later.">
          <FieldTextarea value={cardsText} onChange={(e) => setCardsText(e.target.value)} placeholder={'hola - hello\ngracias - thank you'} className="min-h-[120px] font-mono text-[13px]" />
        </Field>
        {create.error && <p className="text-[13px] text-danger">{create.error.message}</p>}
      </form>
    </Dialog>
  )
}
