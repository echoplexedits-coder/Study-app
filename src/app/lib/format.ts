export function relativeTime(ts: number, now = Date.now()): string {
  const diff = now - ts
  const minutes = Math.round(diff / 60_000)
  if (Math.abs(minutes) < 1) return 'just now'
  if (Math.abs(minutes) < 60) return minutes > 0 ? `${minutes}m ago` : `in ${-minutes}m`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return days > 0 ? `${days}d ago` : `in ${-days}d`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—'
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

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}


/**
 * Deck accents stay inside the crystal-blue family so the library reads as one
 * product; the stored hue only shifts the shade between decks.
 */
export function deckHue(hue: number): number {
  return 198 + (Math.abs(Math.round(hue)) % 34)
}

export function deckGradient(hue: number): string {
  const base = deckHue(hue)
  return `linear-gradient(135deg, hsl(${base} 68% 58%), hsl(${base + 12} 72% 40%))`
}

export function deckAccent(hue: number): string {
  return `hsl(${deckHue(hue)} 70% 52%)`
}
