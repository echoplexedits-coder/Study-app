import { motion } from 'motion/react'
import { ArrowRight, BookOpen, GraduationCap, LayoutGrid, Layers, ListChecks, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { Badge, Button, EmptyState, Skeleton } from '../components/ui'
import { useDecks } from '../lib/api'
import { deckGradient } from '../lib/format'

const modes = [
  {
    key: 'flashcards',
    label: 'Flashcards',
    copy: 'Flip at your own pace',
    icon: Layers,
  },
  {
    key: 'learn',
    label: 'Learn',
    copy: 'Multiple choice, scored',
    icon: GraduationCap,
  },
  {
    key: 'match',
    label: 'Match',
    copy: 'Pair terms against the clock',
    icon: LayoutGrid,
  },
] as const

const ease = [0.22, 1, 0.36, 1] as const

export function Quizzes() {
  const { data, isLoading, isError, refetch } = useDecks()
  const decks = (data?.items ?? []).filter((deck) => deck.cardCount > 0)
  const ready = decks.filter((deck) => deck.cardCount >= 4)

  return (
    <div className="pb-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-accent">Practice</p>
          <h1 className="mt-2 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] text-fg-deep sm:text-[38px]">Quizzes</h1>
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
            Practice runs on a deck you are already reading. There is nothing to create first and no separate quiz bank — pick a
            deck and choose how you want to work through it.
          </p>
        </div>
        <Badge tone="neutral" className="mb-1">
          <ListChecks className="size-3" aria-hidden />
          Secondary feature
        </Badge>
      </header>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {modes.map(({ key, label, copy, icon: Icon }) => (
          <div key={key} className="flex items-center gap-3 rounded-card border border-line/70 bg-surface/70 px-4 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-surface-2 text-accent">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-fg-deep">{label}</span>
              <span className="block text-[11.5px] text-faint">{copy}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold text-muted">Decks you can practise</h2>
        <Link to="/resources" className="text-[12px] font-medium text-accent hover:opacity-80">
          All resources
        </Link>
      </div>

      <div className="mt-3 grid gap-2">
        {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[92px] rounded-card" />)}

        {isError && (
          <EmptyState
            icon={<BookOpen />}
            title="Decks didn't load"
            description="The practice list needs the library, which is unreachable right now."
            action={<Button onClick={() => void refetch()}>Try again</Button>}
          />
        )}

        {!isLoading && !isError && decks.length === 0 && (
          <EmptyState
            icon={<BookOpen />}
            title="No decks to practise yet"
            description="Practice becomes available once a deck with cards has been published."
          />
        )}

        {!isLoading &&
          decks.map((deck, index) => (
            <motion.article
              key={deck.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease, delay: Math.min(index, 8) * 0.03 }}
              className="flex flex-col gap-2.5 rounded-card border border-line/70 bg-surface px-4 py-3.5 shadow-card sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-tile text-[14px] font-bold text-white shadow-[0_8px_18px_-14px_rgb(6_23_51/0.9)]"
                  style={{ background: deckGradient(deck.hue) }}
                  aria-hidden
                >
                  {deck.title[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-fg-deep">{deck.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-faint">
                    {deck.cardCount} cards
                    {deck.mastery > 0 ? ` · ${deck.mastery}% mastered` : ''}
                    {deck.dueCount > 0 ? ` · ${deck.dueCount} due` : ''}
                  </p>
                </div>
              </div>
              {deck.cardCount >= 4 ? (
                <div className="flex flex-wrap gap-1.5">
                  {modes.map(({ key, label }) => (
                    <Link
                      key={key}
                      to={`/decks/${deck.id}/${key}`}
                      className="inline-flex h-8 items-center rounded-full border border-line-strong bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:border-accent/40 hover:bg-accent-soft/50"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  to={`/decks/${deck.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[12px] font-medium text-accent-deep"
                >
                  Read first
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </motion.article>
          ))}

        {!isLoading && !isError && decks.length > 0 && ready.length === 0 && (
          <p className="mt-1 flex items-center gap-2 text-[12px] text-faint">
            <Sparkles className="size-3.5 text-accent/70" aria-hidden />
            Decks need at least four cards before a practice mode opens.
          </p>
        )}
      </div>
    </div>
  )
}
