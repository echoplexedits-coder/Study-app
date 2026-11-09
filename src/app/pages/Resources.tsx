import { motion } from 'motion/react'
import { BookOpen, FileText, FolderOpen, Layers, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { DeckCard } from '../components/DeckCard'
import { Button, EmptyState, Skeleton } from '../components/ui'
import { useDecks } from '../lib/api'

const ease = [0.22, 1, 0.36, 1] as const

export function Resources() {
  const { data, isLoading, isError, refetch } = useDecks()
  const [query, setQuery] = useState('')
  const decks = data?.items ?? []

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return decks
    return decks.filter((deck) => `${deck.title} ${deck.description ?? ''}`.toLowerCase().includes(needle))
  }, [decks, query])

  const cards = decks.reduce((total, deck) => total + deck.cardCount, 0)

  return (
    <div className="pb-4">
      <header>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-accent">Study material</p>
        <h1 className="mt-2 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] text-fg-deep sm:text-[38px]">Resources</h1>
        <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
          The class decks, one topic at a time. Each deck is a set of cards with its own progress, and any files the class shared
          live in the notes library.
        </p>
      </header>

      <div className="mt-7 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <div className="rounded-panel border border-line/80 bg-surface/80 p-3 shadow-card backdrop-blur">
          <label className="relative block">
            <span className="sr-only">Search resources</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search decks"
              className="h-11 w-full rounded-control border border-line-strong bg-surface pl-10 pr-3 text-[13.5px] text-fg placeholder:text-faint transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent/15"
            />
          </label>
        </div>

        <Link
          to="/notes"
          className="group flex items-center gap-3 rounded-panel border border-accent/15 bg-gradient-to-br from-accent-soft/70 to-surface p-4 shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/35"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-accent text-white">
            <FileText className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-fg-deep">Looking for handouts?</span>
            <span className="mt-0.5 block text-[12px] text-muted">The class notes library is where uploaded documents live.</span>
          </span>
          <span className="text-[12px] font-semibold text-accent transition-transform duration-200 group-hover:translate-x-0.5">Open</span>
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12.5px] text-faint">
          {isLoading
            ? 'Loading decks…'
            : `${filtered.length} ${filtered.length === 1 ? 'deck' : 'decks'}${cards > 0 ? ` · ${cards} cards` : ''}`}
        </p>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-faint">
          <Sparkles className="size-3.5 text-accent/70" aria-hidden />
          Progress is saved per account
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-[168px] rounded-card" />)}
        {filtered.map((deck, index) => (
          <DeckCard key={deck.id} deck={deck} index={index} />
        ))}
      </div>

      {!isLoading && isError && (
        <EmptyState
          icon={<BookOpen />}
          title="Decks didn't load"
          description="Check the connection and try once more."
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      )}

      {!isLoading && !isError && decks.length === 0 && (
        <EmptyState
          icon={<FolderOpen />}
          title="No decks published yet"
          description="When the class admin publishes a deck, it appears here with its progress ring."
        />
      )}

      {!isLoading && !isError && decks.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<Search />}
          title="No deck matches that search"
          description="Try a shorter word, or clear the search to see everything."
          action={<Button onClick={() => setQuery('')}>Clear search</Button>}
        />
      )}

      {!isLoading && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.4, ease }}
          className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-panel border border-line/70 bg-surface/70 px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-tile bg-surface-2 text-accent">
              <Layers className="size-4" aria-hidden />
            </span>
            <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-muted">
              Open a deck to read it straight through, or start a practice session from inside it.
            </p>
          </div>
          <Link to="/quizzes" className="text-[12.5px] font-semibold text-accent transition-opacity hover:opacity-80">
            Practice modes →
          </Link>
        </motion.div>
      )}
    </div>
  )
}
